/**
 * Wound tracks: health that is a track, not a number.
 *
 * A `live.tracks` entry that declares `levels` stops being a bounded integer and becomes a column
 * of boxes a MARK sits on. The DEFINITION holds kinds; the LIVE STATE holds marks, and the two
 * words never swap here either.
 *
 * What is pinned:
 *   - Placement in severity order, with a lighter mark pushed down rather than the new one appended.
 *   - The penalty in force is the one on the LOWEST marked level, never the sum of the marked ones.
 *   - An `amount` of several marks is applied ONE AT A TIME, across the point where the track fills.
 *   - A full track upgrades its lowest-severity mark by one step.
 *   - Overflow at the top severity, persisted through storage and read back.
 *   - Healing clears the lightest marks first, and clears overflow before marks.
 *   - A mixed-kind track, because that is where every rule above is actually decided.
 *   - The penalty takes dice off a pool and never below `pool.min`, and is a flat modifier on a sum.
 *   - A plain track behaves exactly as it does today.
 *   - Every refusal, at import and at the command.
 *   - A packaged ruleset with wound tracks needs Capability API 1.30.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetSheetOp,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  parseSkillCheckTagBody,
  readRulesetLive,
  readRulesetWoundPenalty,
  renderRulesetSheetBlock,
  rulesetLiveStatesSchema,
  serializeSheetCommandTag,
  serializeResolvedSkillCheckTag,
  type ResolvedRulesetLive,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetSheetBuild,
  type RulesetSheetOp,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-wound-tracks-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [{ buildSkillCheckRulesetContext, resolveSkillCheckWithContext }, { getCapabilityPackageInstallIssue }] =
    await Promise.all([
      import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
      import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    ]);

  const gravewatchUrl = new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url);
  const gravewatchText = readFileSync(fileURLToPath(gravewatchUrl), "utf8");
  const parsedGravewatch = parseRulesetDefinition(JSON.parse(gravewatchText));
  assert.ok(parsedGravewatch.ok, `the gravewatch example must validate: ${JSON.stringify(parsedGravewatch)}`);
  const gravewatch: RulesetDefinition = parsedGravewatch.definition;

  const build = defaultRulesetSheetBuild(gravewatch);
  /** Apply a command and hand back the state it wrote, so a case reads as a sequence of blows. */
  const apply = (live: RulesetLiveState, op: RulesetSheetOp): { live: RulesetLiveState; now: string } => {
    const result = applyRulesetSheetOp(gravewatch, build, live, op);
    assert.ok(result.ok, `expected ${JSON.stringify(op)} to apply, got ${result.ok ? "" : result.reason}`);
    return { live: result.live, now: result.now };
  };
  const refusal = (live: RulesetLiveState, op: RulesetSheetOp): string => {
    const result = applyRulesetSheetOp(gravewatch, build, live, op);
    assert.equal(result.ok, false, `expected ${JSON.stringify(op)} to be refused`);
    return result.ok ? "" : result.reason;
  };
  const harm = (live: RulesetLiveState): NonNullable<ResolvedRulesetLive["tracks"][number]["wound"]> => {
    const track = readRulesetLive(gravewatch, build, live).tracks.find((entry) => entry.id === "harm");
    assert.ok(track?.wound, "harm is a wound track");
    return track.wound;
  };
  const mark = (live: RulesetLiveState, kind: string, amount: number) =>
    apply(live, { op: "damage", track: "harm", kind, amount });

  // ── A mark is PLACED IN SEVERITY ORDER, never appended ──
  {
    // Two knocks, then a tear. The tear is the more severe, so it takes the FIRST level and both
    // knocks move down a rung. Appending would have left it at the bottom and read the wrong
    // penalty off the track for every roll after it.
    let live = mark({}, "knock", 2).live;
    assert.deepEqual(harm(live).marks, ["knock", "knock"]);
    live = mark(live, "tear", 1).live;
    assert.deepEqual(harm(live).marks, ["tear", "knock", "knock"], "the tear takes the level its severity earns");

    // And the other way round: a knock under two tears goes to the bottom, not the top.
    let other = mark({}, "tear", 2).live;
    other = mark(other, "knock", 1).live;
    assert.deepEqual(harm(other).marks, ["tear", "tear", "knock"]);
  }

  // ── The penalty is the LOWEST marked level's, never a sum ──
  {
    // Gravewatch's rungs are 0, -1, -3, -99. One mark reads 0, two read -1, three read -3.
    assert.equal(harm({}).penalty, 0, "an unmarked track costs nothing");
    assert.equal(harm(mark({}, "knock", 1).live).penalty, 0);
    assert.equal(harm(mark({}, "knock", 2).live).penalty, -1);
    const three = mark({}, "knock", 3).live;
    assert.equal(harm(three).penalty, -3, "the third rung's own penalty, not 0 + -1 + -3");
    assert.equal(harm(mark({}, "knock", 4).live).penalty, -99);
  }

  // ── An `amount` is applied ONE AT A TIME, across the point where the track fills ──
  {
    // Three knocks onto a track already carrying a tear and two knocks. The first fills the fourth
    // level; the next two find a full track and upgrade the lowest-severity mark each time. Applied
    // as one lump it would have been a single upgrade, or three marks on a track with one space.
    let live = mark({}, "tear", 1).live;
    live = mark(live, "knock", 2).live;
    assert.deepEqual(harm(live).marks, ["tear", "knock", "knock"]);
    live = mark(live, "knock", 3).live;
    assert.deepEqual(harm(live).marks, ["tear", "tear", "tear", "knock"]);
    assert.equal(harm(live).overflow, 0, "nothing spilled: there was still a knock to upgrade");

    // The same three blows one command at a time land in exactly the same place.
    let stepwise = mark(mark({}, "tear", 1).live, "knock", 2).live;
    for (let i = 0; i < 3; i++) stepwise = mark(stepwise, "knock", 1).live;
    assert.deepEqual(harm(stepwise).marks, harm(live).marks, "one command of three equals three of one");
  }

  // ── A FULL track upgrades its lowest-severity mark by one step ──
  {
    const full = mark({}, "knock", 4).live;
    assert.deepEqual(harm(full).marks, ["knock", "knock", "knock", "knock"]);
    const upgraded = mark(full, "knock", 1).live;
    assert.deepEqual(
      harm(upgraded).marks,
      ["tear", "knock", "knock", "knock"],
      "the lowest-severity mark climbed one rung and was re-placed at the top",
    );
    assert.equal(harm(upgraded).overflow, 0, "an upgrade is not an overflow");
    // The level count does not move: a full track is still full.
    assert.equal(harm(upgraded).marks.length, 4);
  }

  // ── Overflow at the top severity, persisted and re-read ──
  {
    let live = mark({}, "tear", 4).live;
    assert.deepEqual(harm(live).marks, ["tear", "tear", "tear", "tear"]);
    const blow = mark(live, "tear", 1);
    live = blow.live;
    assert.equal(harm(live).overflow, 1, "nothing left to upgrade, so the mark is counted as an overflow");
    assert.match(blow.now, /over/, "a blow that could not land still says so");

    // Two more in one command: still one at a time, still one overflow each.
    live = mark(live, "knock", 2).live;
    assert.equal(harm(live).overflow, 3);
    assert.deepEqual(harm(live).marks, ["tear", "tear", "tear", "tear"], "the track itself did not change");

    // Through storage and back: a reload must not forget them.
    const stored = rulesetLiveStatesSchema.safeParse({ warden: live });
    assert.ok(stored.success, "the live blob validates at the PATCH boundary");
    const roundTripped = JSON.parse(JSON.stringify(stored.data)) as Record<string, RulesetLiveState>;
    assert.equal(harm(roundTripped.warden!).overflow, 3, "overflow survives a round trip through storage");
    assert.deepEqual(harm(roundTripped.warden!).marks, ["tear", "tear", "tear", "tear"]);
  }

  // ── Healing clears the LIGHTEST first, and clears overflow BEFORE marks ──
  {
    let live = mark({}, "tear", 1).live;
    live = mark(live, "knock", 2).live;
    assert.deepEqual(harm(live).marks, ["tear", "knock", "knock"]);
    live = mark(live, "knock", -1).live;
    assert.deepEqual(harm(live).marks, ["tear", "knock"], "the lightest mark went, not the first one");
    live = mark(live, "knock", -1).live;
    assert.deepEqual(harm(live).marks, ["tear"], "and the next lightest, leaving the worst standing");

    // Overflow first. A track at four tears with two overflowed takes two heals before a mark moves.
    let spilled = mark({}, "tear", 6).live;
    assert.equal(harm(spilled).overflow, 2);
    spilled = mark(spilled, "tear", -2).live;
    assert.equal(harm(spilled).overflow, 0);
    assert.deepEqual(harm(spilled).marks, ["tear", "tear", "tear", "tear"], "the marks waited their turn");
    spilled = mark(spilled, "tear", -1).live;
    assert.deepEqual(harm(spilled).marks, ["tear", "tear", "tear"]);

    // Healing past the end is not an error and never goes negative.
    const cleared = mark(spilled, "tear", -50).live;
    assert.deepEqual(harm(cleared).marks, []);
    assert.equal(harm(cleared).overflow, 0);
    assert.equal(harm(cleared).penalty, 0);
    assert.deepEqual(cleared, {}, "an unmarked track drops out of the stored blob again");
  }

  // ── A mixed-kind track, where all of it is decided at once ──
  {
    // One tear and three knocks: full. Two more knocks upgrade two knocks; a third upgrades the
    // last one; the fourth finds nothing left and spills.
    let live = mark(mark({}, "tear", 1).live, "knock", 3).live;
    assert.deepEqual(harm(live).marks, ["tear", "knock", "knock", "knock"]);
    live = mark(live, "knock", 4).live;
    assert.deepEqual(harm(live).marks, ["tear", "tear", "tear", "tear"]);
    assert.equal(harm(live).overflow, 1);
    assert.equal(harm(live).penalty, -99, "still the lowest marked level's own penalty");

    // One heal takes the overflow; the next takes a tear and the penalty comes back up a rung.
    live = mark(live, "knock", -2).live;
    assert.deepEqual(harm(live).marks, ["tear", "tear", "tear"]);
    assert.equal(harm(live).penalty, -3);
  }

  // ── A rest heals a wound track, and only heals it ──
  {
    let live = mark({}, "tear", 6).live;
    assert.equal(harm(live).overflow, 2);
    // Gravewatch's vigil clears harm `to` its minimum, so it takes the overflow with it.
    live = apply(live, { op: "rest", rest: "vigil" }).live;
    assert.deepEqual(harm(live).marks, []);
    assert.equal(harm(live).overflow, 0);
  }

  // ── And a `by` rest clears the number it ASKED for, overflow and all ──
  {
    // Harm that spilled is still harm, and healing takes it before any box. The shipped rest clears
    // `to` a number, so the other shape needs a ruleset that declares one. The state it is proven
    // on is a short track carrying spill, which is what a saved sheet holds after its ruleset
    // shortened the track under it: reading the boxes alone would stop healing early there.
    const byDoc = JSON.parse(gravewatchText) as Record<string, any>;
    delete byDoc.layers;
    byDoc.id = "gravewatch-by-rest";
    byDoc.rests = [{ id: "breather", label: "Catch a breath", restore: [{ track: "harm", by: { const: -2 } }] }];
    const parsedBy = parseRulesetDefinition(byDoc);
    assert.ok(parsedBy.ok, `the variant must validate: ${JSON.stringify(parsedBy)}`);
    const byDefinition = parsedBy.definition;
    const byBuild = defaultRulesetSheetBuild(byDefinition);
    const rested = applyRulesetSheetOp(
      byDefinition,
      byBuild,
      { wounds: { harm: { marks: ["tear"], overflow: 3 } } },
      { op: "rest", rest: "breather" },
    );
    assert.ok(rested.ok, `the rest must apply: ${rested.ok ? "" : rested.reason}`);
    const after = readRulesetLive(byDefinition, byBuild, rested.live).tracks.find((entry) => entry.id === "harm");
    assert.deepEqual(after?.wound?.marks, ["tear"], "the box is untouched, because spill comes off first");
    assert.equal(after?.wound?.overflow, 1, "and both points the rest asked for came off the spill");
  }

  // ── The penalty takes dice OFF the pool, and never below `pool.min` ──
  {
    // The shipped example EXPLODES its dice, so a rolled pool does not report the number of dice it
    // was built from. Counting dice needs a ruleset that throws exactly what it was given, so this
    // case runs on a copy with the exploding taken out. Nothing else about it changes.
    const plain = JSON.parse(gravewatchText) as Record<string, any>;
    delete plain.layers;
    plain.id = "gravewatch-plain";
    delete plain.resolution.explode;
    // The example's Grave Sight charm moves the exploding face, which a ruleset may only let a
    // check do while its explode rule has a min; a copy that takes the rule away takes the charm too.
    for (const catalog of plain.catalogs ?? []) {
      catalog.entries = (catalog.entries ?? []).filter((entry: any) => entry.mechanics?.check?.explode === undefined);
    }
    const parsedPlain = parseRulesetDefinition(plain);
    assert.ok(parsedPlain.ok, `the variant must validate: ${JSON.stringify(parsedPlain)}`);
    const plainDefinition = parsedPlain.definition;
    const plainBuild = defaultRulesetSheetBuild(plainDefinition);
    const cards = [{ name: "Bram", rulesetSheet: { v: 1, build: plainBuild } }];
    const contextFor = (live: RulesetLiveState | undefined): SkillCheckModifierContext => ({
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(plainDefinition, cards, cards[0], live ? { bram: live } : null),
    });
    const roll = (context: SkillCheckModifierContext) =>
      resolveSkillCheckWithContext(context, { skill: "Nerve", dc: 1 }, () => 7);
    /** The same wound track, marked, read with the variant's own definition. */
    const marked = (kind: string, amount: number) => {
      const result = applyRulesetSheetOp(
        plainDefinition,
        plainBuild,
        {},
        { op: "damage", track: "harm", kind, amount },
      );
      assert.ok(result.ok);
      return result.live;
    };

    const unwounded = roll(contextFor(undefined));
    assert.equal(unwounded.resolution, "successes");
    assert.equal(unwounded.penalty, undefined, "an unwounded check says nothing about a penalty");
    const base = unwounded.rolls.length;
    assert.ok(base > 1, `the blank warden throws more than one die (${base})`);

    // Two marks read the second rung: -1, so one die fewer.
    const winded = roll(contextFor(marked("knock", 2)));
    assert.equal(winded.penalty, -1, "the record says why the pool shrank");
    assert.equal(winded.rolls.length, base - 1);
    const recorded = serializeResolvedSkillCheckTag(winded);
    assert.equal(parseSkillCheckTagBody(recorded.slice("[skill_check: ".length, -1))?.resolvedResult?.penalty, -1);
    const empty = serializeResolvedSkillCheckTag({
      ...winded,
      rolls: [],
      usedRoll: 0,
      total: 0,
      dice: "0d10",
      success: false,
      criticalSuccess: false,
      criticalFailure: false,
    });
    assert.equal(parseSkillCheckTagBody(empty.slice("[skill_check: ".length, -1))?.resolvedResult?.penalty, -1);
    for (const invalid of [0, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.doesNotMatch(serializeResolvedSkillCheckTag({ ...winded, penalty: invalid }), /penalty=/);
      const body = recorded.slice("[skill_check: ".length, -1).replace(/penalty="[^"]*"/, `penalty="${invalid}"`);
      assert.equal(parseSkillCheckTagBody(body)?.resolvedResult?.penalty, undefined);
    }

    // The bottom rung is -99, which is far past the pool. `pool.min` is 1, so one die is thrown.
    const down = roll(contextFor(marked("knock", 4)));
    assert.equal(down.penalty, -99);
    // Read off the union's pool member rather than through an optional, so this says the RULESET's
    // own floor and not whatever an absent field happened to mean.
    const floor = plainDefinition.resolution.kind === "dice-pool" ? plainDefinition.resolution.pool.min : 1;
    assert.equal(floor, 1, "this fixture's ruleset floors its pool at one die");
    assert.equal(down.rolls.length, floor, "floored at the ruleset's own minimum, whatever it declared");
    assert.equal(down.modifier, 0, "a pool spends the penalty on dice, so nothing is added to the successes");

    // Somebody the game has no sheet for rolls unwounded, exactly as they always did.
    const stranger = resolveSkillCheckWithContext(
      contextFor(marked("knock", 4)),
      { skill: "Nerve", dc: 1, who: "A passing stranger" },
      () => 7,
    );
    assert.equal(stranger.penalty, undefined);
  }

  // ── The penalty as a flat modifier on a SUM ──
  {
    // The same wound track on a `dice-sum` ruleset. Nothing about the track changes; what the
    // penalty MEANS is the resolution kind's business.
    const summed = JSON.parse(gravewatchText) as Record<string, any>;
    delete summed.layers;
    // The example's charm changes a POOL check, which a summed ruleset cannot honour and is
    // refused for elsewhere. This case is about the penalty, so it reads the file without one.
    delete summed.catalogs;
    delete summed.sheet.lists;
    delete summed.gm.sheetSummary.lists;
    summed.id = "gravewatch-summed";
    summed.resolution = {
      kind: "dice-sum",
      dice: { count: 1, sides: 20 },
      abilityModifier: { op: "identity" },
      proficiencyTiers: summed.resolution.proficiencyTiers,
      penaltyFrom: "harm",
      difficultyLadder: [{ label: "Plain work", dc: 10 }],
    };
    const parsed = parseRulesetDefinition(summed);
    assert.ok(parsed.ok, `a summed ruleset may name a wound track too: ${JSON.stringify(parsed)}`);
    const sumDefinition = parsed.definition;
    const sumBuild = defaultRulesetSheetBuild(sumDefinition);
    const cards = [{ name: "Bram", rulesetSheet: { v: 1, build: sumBuild } }];
    const contextFor = (live: RulesetLiveState): SkillCheckModifierContext => ({
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(sumDefinition, cards, cards[0], { bram: live }),
    });
    const hurt = applyRulesetSheetOp(
      sumDefinition,
      sumBuild,
      {},
      {
        op: "damage",
        track: "harm",
        kind: "knock",
        amount: 3,
      },
    );
    assert.ok(hurt.ok);
    const clean = resolveSkillCheckWithContext(contextFor({}), { skill: "Nerve", dc: 10 }, () => 12);
    const wounded = resolveSkillCheckWithContext(contextFor(hurt.live), { skill: "Nerve", dc: 10 }, () => 12);
    assert.equal(clean.resolution, "sum");
    assert.equal(wounded.penalty, -3, "the third rung, said in the record");
    const recorded = serializeResolvedSkillCheckTag(wounded);
    assert.equal(parseSkillCheckTagBody(recorded.slice("[skill_check: ".length, -1))?.resolvedResult?.penalty, -3);
    assert.equal(wounded.modifier, clean.modifier - 3, "and folded into the number the dice are added to");
    assert.equal(wounded.total, wounded.usedRoll + wounded.modifier, "the record's own arithmetic still adds up");
    assert.equal(wounded.rolls.length, clean.rolls.length, "a summed check throws the same dice either way");
  }

  // ── A ruleset with a PLAIN track behaves exactly as it does today ──
  {
    const fiveEUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
    const parsed = parseRulesetDefinition(JSON.parse(readFileSync(fileURLToPath(fiveEUrl), "utf8")));
    assert.ok(parsed.ok, "the 5e example must still validate");
    const fiveE = parsed.definition;
    const fiveEBuild = defaultRulesetSheetBuild(fiveE);
    const plain = fiveE.sheet.live.tracks[0];
    assert.ok(plain, "the 5e example has at least one plain track");
    assert.equal(plain.levels, undefined, "a plain track declares no levels");

    const resolved = readRulesetLive(fiveE, fiveEBuild, {}).tracks.find((entry) => entry.id === plain.id);
    assert.equal(resolved?.wound, undefined, "and resolves with no wound state at all");
    const moved = applyRulesetSheetOp(fiveE, fiveEBuild, {}, { op: "track", track: plain.id, by: 1 });
    assert.ok(moved.ok, "the track command still moves a plain track");
    assert.equal(moved.live.tracks?.[plain.id], (plain.default ?? plain.min) + 1);
    assert.equal(moved.live.wounds, undefined, "and writes nothing into the wound record");
  }

  // ── Refusals at import ──
  {
    const document = () => {
      const copy = JSON.parse(gravewatchText) as Record<string, any>;
      delete copy.layers;
      return copy;
    };
    const track = (copy: Record<string, any>) => copy.sheet.live.tracks[0];
    const refuse = (copy: Record<string, any>, pattern: RegExp) => {
      const parsed = parseRulesetDefinition(copy);
      assert.equal(parsed.ok, false, `expected a refusal matching ${pattern}`);
      const issues = parsed.ok ? [] : parsed.issues;
      assert.ok(
        issues.some((issue) => pattern.test(issue)),
        `expected ${pattern} in ${JSON.stringify(issues)}`,
      );
    };

    // Kinds with nothing to mark.
    {
      const copy = document();
      delete track(copy).levels;
      delete copy.resolution.penaltyFrom;
      copy.sheet.live.tracks[0].max = 4;
      refuse(copy, /kinds needs levels/);
    }
    // Levels with nothing to mark them WITH.
    {
      const copy = document();
      delete track(copy).kinds;
      refuse(copy, /needs kinds beside it/);
    }
    // Two kinds at one severity: "the lowest-severity mark" would name two boxes.
    {
      const copy = document();
      track(copy).kinds[1].severity = track(copy).kinds[0].severity;
      refuse(copy, /Duplicate severity/);
    }
    // More levels than a track may have.
    {
      const copy = document();
      track(copy).levels = Array.from({ length: 17 }, (_, index) => ({ label: `Rung ${index}`, penalty: 0 }));
      track(copy).max = 17;
      refuse(copy, /levels/);
    }
    // A length that disagrees with the levels.
    {
      const copy = document();
      track(copy).max = 9;
      refuse(copy, /one mark per level, so its max is 4/);
    }
    // A penalty track that is not a wound track at all.
    {
      const copy = document();
      delete track(copy).levels;
      delete track(copy).kinds;
      track(copy).max = 4;
      refuse(copy, /no levels, so it carries no penalty/);
    }
    // A penalty track nobody declared.
    {
      const copy = document();
      copy.resolution.penaltyFrom = "nowhere";
      refuse(copy, /Unknown track "nowhere"/);
    }
  }

  // ── Refusals at the command ──
  {
    assert.equal(refusal({}, { op: "damage", track: "harm", kind: "scratch", amount: 1 }), "unknown-kind");
    assert.equal(refusal({}, { op: "damage", track: "nowhere", kind: "knock", amount: 1 }), "unknown-track");
    assert.equal(refusal({}, { op: "damage", track: "harm", kind: "knock", amount: 0 }), "bad-amount");
    assert.equal(refusal({}, { op: "damage", track: "harm", kind: "knock", amount: 1.5 }), "bad-amount");
    // A wound track is marked with kinds, so a bare number cannot say what the new marks are.
    assert.equal(refusal({}, { op: "track", track: "harm", by: 1 }), "wrong-track");
    assert.equal(refusal({}, { op: "track", track: "harm", to: 2 }), "wrong-track");
    // A refusal changes nothing.
    const hurt = mark({}, "knock", 2).live;
    const after = applyRulesetSheetOp(gravewatch, build, hurt, {
      op: "damage",
      track: "harm",
      kind: "scratch",
      amount: 1,
    });
    assert.equal(after.ok, false);
    assert.deepEqual(harm(hurt).marks, ["knock", "knock"], "the state the refusal was applied to is untouched");
  }

  // ── The tag layer reads and writes the new shape ──
  {
    const parsed = parseSheetCommandTagBody(`who="Bram" op="damage" track="harm" kind="tear" amount="2"`);
    assert.deepEqual(parsed.op, { op: "damage", track: "harm", kind: "tear", amount: 2 });
    // A `damage` naming a pool is untouched, so a ruleset whose health is a pool reads as it did.
    assert.deepEqual(parseSheetCommandTagBody(`op="damage" pool="resolve" amount="3"`).op, {
      op: "damage",
      pool: "resolve",
      amount: 3,
    });
    // A track with no kind says nothing the Engine could act on.
    assert.equal(parseSheetCommandTagBody(`op="damage" track="harm" amount="2"`).op, null);

    const written = serializeSheetCommandTag(
      { who: "Bram", op: parsed.op, raw: "" },
      { ok: true, now: "Harm 2/4 Winded" },
    );
    assert.match(written, /op="damage" track="harm" kind="tear" amount="2"/);
    assert.deepEqual(parseSheetCommandTagBody(written.slice("[sheet: ".length, -1)).op, parsed.op);
  }

  // ── The Game Master's sheet block says the track, the level and what it costs ──
  {
    const unmarked = renderRulesetSheetBlock(gravewatch, { name: "Bram", build }, {});
    assert.doesNotMatch(unmarked, /Harm/, "an unmarked track is the absence of a fact");
    const marked = renderRulesetSheetBlock(gravewatch, { name: "Bram", build }, mark({}, "knock", 3).live);
    assert.match(marked, /Harm 3\/4 Bleeding -3 to rolls/);
    const spilled = renderRulesetSheetBlock(gravewatch, { name: "Bram", build }, mark({}, "tear", 6).live);
    assert.match(spilled, /\+2 over/);
  }

  // ── The penalty reader the resolver uses ──
  {
    assert.equal(readRulesetWoundPenalty(gravewatch, {}, "harm"), 0);
    assert.equal(readRulesetWoundPenalty(gravewatch, mark({}, "knock", 3).live, "harm"), -3);
    assert.equal(readRulesetWoundPenalty(gravewatch, mark({}, "knock", 3).live, "nowhere"), 0);
    // Junk in the blob costs that one entry, never a throw.
    assert.equal(readRulesetWoundPenalty(gravewatch, { wounds: { harm: "nonsense" } }, "harm"), 0);
    assert.equal(readRulesetWoundPenalty(gravewatch, { wounds: { harm: { marks: ["gone", "knock"] } } }, "harm"), 0);
  }

  // ── Install gate: a packaged ruleset with wound tracks needs 1.30 ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-gravewatch",
      name: "Gravewatch",
      version: "0.1.0",
      description: "A packaged ruleset with a wound track.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const document = JSON.parse(gravewatchText) as Record<string, any>;
    // The example also carries a layer and a pool resolution, which have gates of their own.
    delete document.layers;
    // And 1.37's: the rules a check may move, two abilities together, and the charm that moves one.
    delete document.resolution.explode.min;
    delete document.resolution.pool.abilityPlusAbility;
    // And 1.38's standing re-throw.
    delete document.resolution.reroll;
    for (const catalog of document.catalogs ?? []) {
      catalog.entries = (catalog.entries ?? []).filter((entry: any) => entry.mechanics?.check?.explode === undefined);
    }
    // The example trips more than one of 1.30's rules at once, so the reason it gives is whichever
    // the gate reads first; what matters here is that 29 is refused and 30 installs. Each rule's
    // own wording is pinned below, on a document that trips only that one.
    assert.match(
      getCapabilityPackageInstallIssue(manifest(29) as never, document) ?? "",
      /capabilityApi 1\.30 or newer/,
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(30) as never, document), null);
    // The wound track on its own, with no charm and no spend beside it.
    const tracked = {
      sheet: {
        live: {
          tracks: [
            {
              id: "harm",
              label: "Harm",
              min: 0,
              max: 2,
              levels: [
                { label: "Hurt", penalty: 0 },
                { label: "Down", penalty: -2 },
              ],
              kinds: [{ id: "knock", label: "K", severity: 0 }],
            },
          ],
        },
      },
    };
    assert.match(
      getCapabilityPackageInstallIssue(manifest(29) as never, tracked) ?? "",
      /wound tracks requires schemaVersion 2 and capabilityApi 1\.30 or newer/,
    );

    // `penaltyFrom` on its own is the same gate, because an older Engine refuses that key too.
    const named = { resolution: { kind: "dice-sum", penaltyFrom: "harm" } };
    assert.match(
      getCapabilityPackageInstallIssue(manifest(28) as never, named) ?? "",
      /wound tracks requires schemaVersion 2 and capabilityApi 1\.30 or newer/,
    );
    // The other two halves of 1.30 need no track at all, so each is its own reason. Without these
    // a package shipping either would install under an older number and then have its whole
    // ruleset.json refused at parse time, which is the failure this gate exists to replace.
    const spending = {
      resolution: { kind: "dice-pool", spend: [{ pool: "resolve", amount: 1, successes: 1, perCheck: 2 }] },
    };
    assert.match(
      getCapabilityPackageInstallIssue(manifest(29) as never, spending) ?? "",
      /spend a resource requires schemaVersion 2 and capabilityApi 1\.30 or newer/,
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(30) as never, spending), null);
    const charm = {
      catalogs: [
        {
          id: "charms",
          label: "Charms",
          feeds: ["charms"],
          entries: [{ id: "c", label: "C", mechanics: { kind: "utility", check: { successes: 1 } } }],
        },
      ],
    };
    assert.match(
      getCapabilityPackageInstallIssue(manifest(29) as never, charm) ?? "",
      /catalog entries change a check requires schemaVersion 2 and capabilityApi 1\.30 or newer/,
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(30) as never, charm), null);

    // A ruleset with only plain tracks installs on whatever it always needed.
    const plain = { sheet: { live: { tracks: [{ id: "exhaustion", label: "Exhaustion", min: 0, max: 6 }] } } };
    assert.equal(getCapabilityPackageInstallIssue(manifest(20) as never, plain), null);
  }

  console.info("game ruleset wound-track regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
