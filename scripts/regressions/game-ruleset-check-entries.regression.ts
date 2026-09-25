/**
 * Issue #6411: a catalog entry that changes a CHECK.
 *
 * The standing-rule half (`resolution.spend`) is pinned in `game-ruleset-check-spend`. This is the
 * per-entry half: `mechanics.check` on something the character actually picked, named on the check
 * itself with `use=`, paid for through the same machinery that upcasts a spell.
 *
 * What is pinned:
 *   - The entry is matched by `planRulesetUse`'s own rules, so one name means one thing everywhere.
 *   - The cost comes off the sheet through the same plan a `[sheet:]` use goes through.
 *   - A re-throw of the low faces really re-throws them, deterministically, under scripted dice.
 *   - `until` keeps going and is bounded by the Engine's own ceiling, not by the ruleset.
 *   - `perCostStep` is what makes an entry scale; paying more for one that does not buys one use.
 *   - All or nothing: a pool that cannot cover it applies nothing and deducts nothing.
 *   - An entry the character does not have, or whose catalogs could not be read, does nothing.
 *   - The Engine still rolls: what the model writes in `rolls=` is discarded either way.
 *   - Every refusal at import.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  readRulesetLive,
  rollDicePoolCheck,
  rowsFromCatalogEntry,
  RULESET_POOL_MAX_REROLLS,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetLiveStates,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-check-entries-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const { buildSkillCheckRulesetContext, resolveSkillCheckWithContext, resolveSkillCheckTagsInContent } =
    await import("../../packages/server/src/services/game/skill-check-resolution.service.js");

  const gravewatchUrl = new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url);
  const gravewatchText = readFileSync(fileURLToPath(gravewatchUrl), "utf8");
  const parsed = parseRulesetDefinition(JSON.parse(gravewatchText));
  assert.ok(parsed.ok, `the gravewatch example must validate: ${JSON.stringify(parsed)}`);
  const gravewatch: RulesetDefinition = parsed.definition;

  const charm = gravewatch.catalogs?.[0]?.entries?.find((entry) => entry.id === "steady-hand");
  assert.ok(charm?.mechanics?.check, "the example ships a charm that changes a check");
  const catalogs: RulesetCatalogEntriesById = { charms: gravewatch.catalogs![0]!.entries! };

  /** A warden who has actually picked the charm, which is what `use=` matches against. */
  const build = (() => {
    const base = defaultRulesetSheetBuild(gravewatch);
    const rows = rowsFromCatalogEntry("charms", charm).map((entry) => entry.row);
    return { ...base, lists: { ...base.lists, charms: rows } } as RulesetSheetBuild;
  })();
  /** And one who never picked it. */
  const bare = defaultRulesetSheetBuild(gravewatch);

  const cards = [{ name: "Bram", rulesetSheet: { v: 1, build } }];
  const contextFor = (
    live: RulesetLiveStates | null,
    withCatalogs: RulesetCatalogEntriesById | null = catalogs,
    sheets = cards,
  ): SkillCheckModifierContext => ({
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: buildSkillCheckRulesetContext(gravewatch, sheets, sheets[0], live, withCatalogs),
  });
  const resolveLeft = (live: RulesetLiveStates | null) =>
    readRulesetLive(gravewatch, build, live?.bram).pools.find((pool) => pool.key === "resolve")!.value;
  const full = resolveLeft(null);
  assert.ok(full >= 2, `the blank warden has Resolve to spend (${full})`);

  const { renderGameRulesetSheetBlocks } =
    await import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js");
  const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");
  const external = parseRulesetDefinition({
    ...gravewatch,
    catalogs: gravewatch.catalogs?.map(({ entries: _entries, ...catalog }) => ({
      ...catalog,
      asset: `catalogs/${catalog.id}.json`,
    })),
  });
  assert.ok(external.ok);
  const formatContext = { hasSceneModel: true } as Parameters<typeof buildGmFormatReminder>[0];
  assert.match(
    buildGmFormatReminder({ ...formatContext, ruleset: external.definition }),
    /use="Its name"/,
    "Packaged catalog abilities must be available to the GM even when entries live in a separate asset",
  );
  const prompt = renderGameRulesetSheetBlocks(gravewatch, cards, null, catalogs).join("\n");
  assert.match(prompt, /Steady Hand \(check:.*reroll.*1.*once.*successes.*1/);
  assert.match(prompt, /cost: 1 resolve/);
  assert.doesNotMatch(
    renderGameRulesetSheetBlocks(
      gravewatch,
      [{ name: "Bram", rulesetSheet: { v: 1, build: bare } }],
      null,
      catalogs,
    ).join("\n"),
    /check:/,
    "The GM must not be offered an unpicked catalog ability",
  );
  assert.doesNotMatch(renderGameRulesetSheetBlocks(gravewatch, cards, null, {}).join("\n"), /check:/);

  /** Roll one check and hand back the result plus whatever the purchase wrote. */
  const roll = (
    context: SkillCheckModifierContext,
    request: Parameters<typeof resolveSkillCheckWithContext>[1],
    die: () => number = () => 1,
  ) => {
    let written: RulesetLiveStates | null = null;
    const result = resolveSkillCheckWithContext(context, request, die, (key, state) => {
      written = { ...(written ?? {}), [key]: state };
    });
    return { result, written };
  };

  // ── The re-throw itself, straight at the roller where the die can be scripted ──
  {
    // Eight dice: four 1s and four 9s on a target of 7. Without the charm the 1s count nothing and
    // cancel four successes. With it, each 1 is thrown again and comes up 9.
    const faces = [1, 1, 1, 1, 9, 9, 9, 9];
    const scripted = () => {
      const next = faces.shift();
      assert.ok(next !== undefined, "the script ran out of dice");
      return next;
    };
    const plain = rollDicePoolCheck(gravewatch, { modifier: 8, required: 1, isSave: false }, scripted);
    assert.deepEqual(plain.rolls, [1, 1, 1, 1, 9, 9, 9, 9]);
    assert.equal(plain.rerolled, 0);
    assert.equal(plain.total, 0, "four successes, cancelled by four ones");

    const again = [1, 1, 1, 1, 9, 9, 9, 9, 8, 8, 8, 8];
    const rerolled = rollDicePoolCheck(
      gravewatch,
      { modifier: 8, required: 1, isSave: false, bought: { reroll: { upTo: 1, mode: "once" } } },
      () => {
        const next = again.shift();
        assert.ok(next !== undefined, "the script ran out of dice");
        return next;
      },
    );
    assert.deepEqual(rerolled.rolls, [8, 8, 8, 8, 9, 9, 9, 9], "the four ones were replaced in place");
    assert.equal(rerolled.rerolled, 4, "and the record says how many");
    assert.equal(rerolled.total, 8, "nothing cancels any more, so every die counts");

    // `once` lets the new face stand even when it would qualify again.
    const stubborn = [1, 1];
    const onceOnly = rollDicePoolCheck(
      gravewatch,
      { modifier: 1, required: 1, isSave: false, bought: { reroll: { upTo: 1, mode: "once" } } },
      () => {
        const next = stubborn.shift();
        assert.ok(next !== undefined, "the script ran out of dice");
        return next;
      },
    );
    assert.deepEqual(onceOnly.rolls, [1], "one die, thrown again once, and the second 1 stands");
    assert.equal(onceOnly.rerolled, 1);
  }

  // ── `until` keeps going, and the Engine's own ceiling is what stops it ──
  {
    // A die that is always a 1, which is what a pathological ruleset would look like from here.
    const forever = rollDicePoolCheck(
      gravewatch,
      { modifier: 1, required: 1, isSave: false, bought: { reroll: { upTo: 1, mode: "until" } } },
      () => 1,
    );
    assert.equal(forever.rerolled, RULESET_POOL_MAX_REROLLS, "it stopped at the Engine's ceiling, not the file's");
    assert.deepEqual(forever.rolls, [1], "and the die is still the face it kept landing on");

    // And an honest `until` stops the moment the die clears.
    const climbing = [1, 1, 1, 9];
    const cleared = rollDicePoolCheck(
      gravewatch,
      { modifier: 1, required: 1, isSave: false, bought: { reroll: { upTo: 1, mode: "until" } } },
      () => {
        const next = climbing.shift();
        assert.ok(next !== undefined, "the script ran out of dice");
        return next;
      },
    );
    assert.deepEqual(cleared.rolls, [9]);
    assert.equal(cleared.rerolled, 3);
  }

  // ── Through the resolver: the entry is found, paid for, and applied ──
  {
    const bought = roll(contextFor(null), { skill: "Nerve", dc: 1, useEntry: "Steady Hand" });
    assert.equal(bought.result.used, "Steady Hand", "the record says which charm it was");
    assert.deepEqual(bought.result.spent, { pool: "resolve", amount: 1 }, "and what it cost");
    assert.equal(bought.result.autoSuccesses, 1, "the charm hands over a success as well as a re-throw");
    // The re-throw itself is pinned at the roller above, where the die can be scripted. The
    // injected die stands in only for a d20 and this ruleset throws d10s, so what the pool shows
    // here is the real generator's and nothing about it can be asserted on. What IS asserted is
    // that the charm reached the roll at all: the effect it was read into, and the cost it paid.
    // Either the charm threw some dice again and says how many, or it says nothing at all. Anything
    // else is the field meaning something it should not.
    assert.ok(
      bought.result.rerolled === undefined || Number.isInteger(bought.result.rerolled),
      `rerolled is a count or nothing, not ${JSON.stringify(bought.result.rerolled)}`,
    );
    assert.equal(resolveLeft(bought.written), full - 1, "the point really left the sheet");

    // Named by the row's own name on the sheet, which is the other half of the same match.
    const byRow = roll(contextFor(null), { skill: "Nerve", dc: 1, useEntry: "steady hand" });
    assert.equal(byRow.result.used, "Steady Hand", "matched without case, like every other name here");

    // A check that names nothing is untouched.
    const plain = roll(contextFor(null), { skill: "Nerve", dc: 1 });
    assert.equal(plain.result.used, undefined);
    assert.equal(plain.result.rerolled, undefined);
    assert.equal(plain.result.spent, undefined);
    assert.equal(plain.written, null);
  }

  for (const counterOnly of [false, true]) {
    const document = JSON.parse(gravewatchText);
    delete document.layers;
    const entry = document.catalogs[0].entries[0];
    delete entry.mechanics.cost;
    delete entry.mechanics.perCostStep;
    if (counterOnly) {
      document.sheet.lists[0].columns.push({ id: "uses", label: "Uses", type: "number", min: 0, max: 1 });
      document.sheet.lists[0].pools = { nameColumn: "name", maxColumn: "uses" };
      entry.rows[0].values.uses = 1;
    }
    const parsedEntry = parseRulesetDefinition(document);
    assert.ok(parsedEntry.ok, JSON.stringify(parsedEntry));
    const definition = parsedEntry.definition;
    const selected = definition.catalogs![0]!.entries![0]!;
    const selectedBuild = defaultRulesetSheetBuild(definition);
    selectedBuild.lists.charms = rowsFromCatalogEntry("charms", selected).map(({ row }) => row);
    const selectedCards = [{ name: "Bram", rulesetSheet: { v: 1, build: selectedBuild } }];
    const context: SkillCheckModifierContext = {
      ...contextFor(null),
      ruleset: buildSkillCheckRulesetContext(definition, selectedCards, selectedCards[0], null, { charms: [selected] }),
    };
    const applied = roll(context, { skill: "Nerve", dc: 1, useEntry: "Steady Hand" });
    assert.equal(applied.result.used, "Steady Hand", "An entry does not need a live-pool cost to affect a check");
    assert.equal(applied.result.autoSuccesses, 1);
    if (counterOnly) {
      const remaining = readRulesetLive(definition, selectedBuild, applied.written?.bram).pools.find(
        (pool) => pool.listId === "charms",
      );
      assert.equal(remaining?.value, 0, "Counter-only effects still persist their charge");
      assert.equal(applied.result.spent?.amount, 1);
    } else {
      assert.equal(applied.result.spent, undefined, "A free check effect must not invent a payment");
    }
  }

  // Direct callers must not buy fixed rerolls or thresholds without paying the base cost.
  for (const amount of [0, -1, -5]) {
    const applied = roll(contextFor(null), {
      skill: "Nerve",
      dc: 1,
      useEntry: "Steady Hand",
      spend: { pool: "resolve", amount },
    });
    assert.deepEqual(applied.result.spent, { pool: "resolve", amount: 1 });
    assert.equal(resolveLeft(applied.written), full - 1);
  }

  assert.match(prompt, /spend="resolve:N".*positive multiple of 1/);

  // ── `perCostStep` is what makes it scale, and the cost scales with it ──
  {
    const twice = roll(contextFor(null), {
      skill: "Nerve",
      dc: 1,
      useEntry: "Steady Hand",
      spend: { pool: "resolve", amount: 2 },
    });
    assert.deepEqual(twice.result.spent, { pool: "resolve", amount: 2 }, "two points, two uses");
    assert.equal(twice.result.autoSuccesses, 2, "and twice the successes");
    assert.equal(resolveLeft(twice.written), full - 2);

    // An entry that does NOT declare `perCostStep` is bought once however much was offered.
    const flat = JSON.parse(gravewatchText) as Record<string, any>;
    delete flat.layers;
    flat.id = "gravewatch-flat";
    delete flat.catalogs[0].entries[0].mechanics.perCostStep;
    const flatParsed = parseRulesetDefinition(flat);
    assert.ok(flatParsed.ok, `an entry that does not scale still validates: ${JSON.stringify(flatParsed)}`);
    const flatCatalogs: RulesetCatalogEntriesById = { charms: flatParsed.definition.catalogs![0]!.entries! };
    const flatContext: SkillCheckModifierContext = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(flatParsed.definition, cards, cards[0], null, flatCatalogs),
    };
    let flatWritten: RulesetLiveStates | null = null;
    const once = resolveSkillCheckWithContext(
      flatContext,
      { skill: "Nerve", dc: 1, useEntry: "Steady Hand", spend: { pool: "resolve", amount: 2 } },
      () => 1,
      (key, state) => {
        flatWritten = { [key]: state };
      },
    );
    assert.deepEqual(once.spent, { pool: "resolve", amount: 1 }, "one use, one point, whatever was offered");
    assert.equal(once.autoSuccesses, 1);
    assert.equal(resolveLeft(flatWritten), full - 1);
  }

  // ── All or nothing, and every reason there is for nothing ──
  {
    // A pool that cannot cover it.
    const broke = roll(contextFor({ bram: { pools: { resolve: { value: 0 } } } }), {
      skill: "Nerve",
      dc: 1,
      useEntry: "Steady Hand",
    });
    assert.equal(broke.result.used, undefined, "nothing was applied");
    assert.equal(broke.result.spent, undefined);
    assert.equal(broke.result.rerolled, undefined, "so the dice are the ones they would have been");
    assert.equal(broke.written, null, "and nothing was deducted");

    // A character who never picked the charm.
    const without = roll(contextFor(null, catalogs, [{ name: "Bram", rulesetSheet: { v: 1, build: bare } }]), {
      skill: "Nerve",
      dc: 1,
      useEntry: "Steady Hand",
    });
    assert.equal(without.result.used, undefined, "a charm nobody has does nothing");
    assert.equal(without.written, null);

    // And a `spend=` beside a named charm is that charm's PRICE, not a standing purchase of its
    // own. When the charm cannot be applied the points stay on the sheet: buying the ruleset's own
    // spend with them would hand the player an effect nobody asked for and charge them for it.
    const priced = roll(contextFor(null, catalogs, [{ name: "Bram", rulesetSheet: { v: 1, build: bare } }]), {
      skill: "Nerve",
      dc: 1,
      useEntry: "Steady Hand",
      spend: { pool: "resolve", amount: 1 },
    });
    assert.equal(priced.result.used, undefined, "the charm it named is the only thing that could be bought");
    assert.equal(priced.result.spent, undefined, "so nothing was paid");
    assert.equal(priced.result.autoSuccesses, undefined, "and no success was handed over in its place");
    assert.equal(priced.written, null);
    // The same spend with NO charm named is the ruleset's own, and still works.
    const standing = roll(contextFor(null, catalogs, [{ name: "Bram", rulesetSheet: { v: 1, build: bare } }]), {
      skill: "Nerve",
      dc: 1,
      spend: { pool: "resolve", amount: 1 },
    });
    assert.deepEqual(standing.result.spent, { pool: "resolve", amount: 1 }, "the standing spend is untouched");

    // Catalogs the caller could not read at all read as the character not having it.
    const blind = roll(contextFor(null, null), { skill: "Nerve", dc: 1, useEntry: "Steady Hand" });
    assert.equal(blind.result.used, undefined, "the Engine will not guess what a charm costs");
    assert.equal(blind.written, null);

    // A name nothing answers to.
    const unknown = roll(contextFor(null), { skill: "Nerve", dc: 1, useEntry: "Nonsense" });
    assert.equal(unknown.result.used, undefined);
    assert.equal(unknown.written, null);
  }

  // ── Through the tag resolver, with the model's own numbers discarded ──
  {
    const context = contextFor(null);
    const rolled = await resolveSkillCheckTagsInContent(
      `She steadies her hand. [skill_check: skill="Nerve" dc="1" use="Steady Hand" rolls="9|9|9" total="3" result="success"]`,
      { loadContext: async () => context, rulesetPinned: true, loadCatalogs: async () => catalogs },
    );
    assert.equal(rolled.resolved, 1, "the Engine rolled it rather than believing the model");
    assert.match(rolled.content, /use="Steady Hand"/, "the record says which charm was applied");
    assert.match(rolled.content, /spend="resolve:1"/, "and what it cost");
    assert.ok(rolled.live, "the cost rides out with the turn");
    assert.equal(resolveLeft(rolled.live!), full - 1);
    const record = parseSkillCheckTagBody(/\[skill_check:([^\]]+)\]/.exec(rolled.content)![1]!);
    assert.equal(record?.useEntry, "Steady Hand", "and it reads back as the ask it was");

    // A turn that names no entry never asks for the catalogs at all.
    let asked = 0;
    await resolveSkillCheckTagsInContent(`[skill_check: skill="Nerve" dc="1"]`, {
      loadContext: async () => contextFor(null, null),
      rulesetPinned: true,
      loadCatalogs: async () => {
        asked += 1;
        return catalogs;
      },
    });
    assert.equal(asked, 0, "an ordinary turn reads no catalog file");
  }

  // ── The tag reader ──
  {
    assert.equal(parseSkillCheckTagBody(`skill="Nerve" dc="2" use="Steady Hand"`)?.useEntry, "Steady Hand");
    assert.equal(parseSkillCheckTagBody(`skill="Nerve" dc="2" use=""`)?.useEntry, undefined);
    assert.equal(parseSkillCheckTagBody(`skill="Nerve" dc="2"`)?.useEntry, undefined);
    // A catalog entry's label may be 120 characters, so a name that long still arrives whole: a
    // shorter cut here would make an entry with a long label impossible to name at all.
    const longest = "L".repeat(120);
    assert.equal(parseSkillCheckTagBody(`skill="Nerve" dc="2" use="${longest}"`)?.useEntry, longest);
  }

  // ── Refusals at import ──
  {
    const refuse = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const doc = JSON.parse(gravewatchText) as Record<string, any>;
      delete doc.layers;
      edit(doc);
      const result = parseRulesetDefinition(doc);
      assert.equal(result.ok, false, `expected a refusal matching ${pattern}`);
      const issues = result.ok ? [] : result.issues;
      assert.ok(
        issues.some((issue) => pattern.test(issue)),
        `expected ${pattern} in ${JSON.stringify(issues)}`,
      );
    };

    // A summed ruleset has no pool for any of it to change.
    refuse((doc) => {
      doc.resolution = {
        kind: "dice-sum",
        dice: { count: 1, sides: 20 },
        abilityModifier: { op: "identity" },
        proficiencyTiers: doc.resolution.proficiencyTiers,
        difficultyLadder: [{ label: "Plain work", dc: 10 }],
      };
      delete doc.sheet.live.tracks;
    }, /no pool for a check effect to change/);

    // A re-throw outside the die's faces. This ruleset throws d10, so 10 would throw everything.
    refuse((doc) => {
      doc.catalogs[0].entries[0].mechanics.check.reroll.upTo = 10;
    }, /throws d10, so a re-throw is on a face from 1 to 9/);
    refuse((doc) => {
      doc.catalogs[0].entries[0].mechanics.check.reroll.upTo = 0;
    }, /reroll/);

    // A per-die target the ruleset does not count on.
    refuse((doc) => {
      doc.catalogs[0].entries[0].mechanics.check.threshold = 2;
    }, /counts on 5 to 9/);

    // An effect that does nothing at all.
    refuse((doc) => {
      doc.catalogs[0].entries[0].mechanics.check = {};
    }, /does something, or is left out/);

    // Past what the Engine lets one use be worth.
    refuse((doc) => {
      doc.catalogs[0].entries[0].mechanics.check.successes = 99;
    }, /successes/);
  }

  console.info("game ruleset check-entry regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
