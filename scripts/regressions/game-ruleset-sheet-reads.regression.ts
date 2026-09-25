/**
 * What a sheet can read (issue #6653): values that read a live track or pool, a cap on a skill or
 * save, a list's column added up, and a `hideWhen` that compares with `notEquals` or `in`.
 * Capability API 1.39.
 *
 * What is pinned here:
 *   - `liveTrack` (with `read`: value, filled, remaining, penalty) and `livePool` read the live state
 *     as it stands, or at its declared defaults where none is at hand (the editor, an import review).
 *     A hidden or missing one reads 0.
 *   - Nothing worked out without a live state may read one, directly or through a derived value or
 *     a capped skill: a pool's or track's maximum, the proficiency bonus, a catalog's scaling.
 *   - A skill or save `cap` holds its number down, a `with=` swap is capped again, and a cap cannot
 *     read a skill or save (or a derived chain that does).
 *   - `listSum` adds a number column, only rows a boolean marks where `onlyWhen` names one; an empty
 *     cell is its column's default and a hidden list adds nothing.
 *   - `hideWhen` with `notEquals` and `in`, their import checks per value, and layers that would
 *     remove a value they compare with.
 *   - The check path (sheet number, modifier off the sheet, spend limit) and a fight read the snapshot.
 *   - The reminder describes a spend limit read off the live state or a list.
 *   - Every new key needs Capability API 1.39 to install, in the ruleset or a catalog file.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetSheetOp,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  evaluateRulesetSheetLive,
  isRulesetItemHidden,
  matchRulesetCheckTarget,
  parseRulesetDefinition,
  rulesetCheckModifier,
  rulesetCombatant,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-sheet-reads-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [
    { buildSkillCheckRulesetContext, rulesetCheckAdjustFor, rulesetCheckModifierFor, planRulesetCheckPurchase },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
  ] = await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");

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
  /** A warden with Warmth 3 and Soothe at its third rating: six dice before any cap. */
  const warden = (definition: RulesetDefinition = gravewatch): RulesetSheetBuild => {
    const build = defaultRulesetSheetBuild(definition);
    build.abilities = { ...build.abilities, warmth: 3 };
    build.skills = { ...build.skills, soothe: "rating_3" };
    return build;
  };
  /** A live state with Resolve at `resolve` and `marks` knocks on Harm, written the way play writes it. */
  const hurt = (build: RulesetSheetBuild, resolve: number, marks: number): RulesetLiveState => {
    let live: RulesetLiveState = { pools: { resolve: { value: resolve } } };
    if (marks > 0) {
      const marked = applyRulesetSheetOp(gravewatch, build, live, {
        op: "damage",
        track: "harm",
        kind: "knock",
        amount: marks,
      });
      assert.ok(marked.ok);
      live = marked.live;
    }
    return live;
  };

  // ── Refused at import ──
  {
    refuses(
      gravewatchText,
      (doc) => doc.sheet.derived.push({ id: "x", label: "X", op: "sum", of: [{ liveTrack: "nerves" }] }),
      /Unknown track "nerves"/,
      "a track the sheet does not have",
    );
    refuses(
      gravewatchText,
      (doc) => doc.sheet.derived.push({ id: "x", label: "X", op: "sum", of: [{ livePool: "blood" }] }),
      /Unknown pool "blood"/,
      "a pool the sheet does not have",
    );
    refuses(
      emberText,
      (doc) => doc.sheet.derived.push({ id: "x", label: "X", op: "sum", of: [{ liveTrack: "heat", read: "penalty" }] }),
      /"heat" is not a wound track, so it has no penalty to read/,
      "a plain track has no penalty",
    );
    refuses(
      gravewatchText,
      (doc) => doc.sheet.derived.push({ id: "x", label: "X", op: "sum", of: [{ field: "lantern", read: "value" }] }),
      /read goes only beside liveTrack/,
      "read with nothing to read",
    );
    refuses(
      gravewatchText,
      (doc) =>
        doc.sheet.derived.push({ id: "x", label: "X", op: "sum", of: [{ liveTrack: "harm", livePool: "resolve" }] }),
      /A value reference names exactly one of/,
      "two live reads in one reference",
    );
    // A maximum is worked out before there is a live state to read, directly or through anything.
    refuses(
      gravewatchText,
      (doc) => (doc.sheet.live.pools[0].max = { liveTrack: "harm", read: "remaining" }),
      /sheet\.live\.pools\.0\.max\.liveTrack: This value is worked out without the live state/,
      "a pool's maximum off a live track",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.sheet.live.pools[0].max = { derived: "harm_left" }),
      /sheet\.live\.pools\.0\.max\.derived: Derived value "harm_left" reads the live state, which this value cannot/,
      "a pool's maximum through a derived value that reads one",
    );
    refuses(
      gravewatchText,
      (doc) => {
        doc.sheet.derived.push({
          id: "chain",
          label: "Chain",
          op: "scale",
          of: { derived: "harm_left" },
          multiplier: 2,
        });
        doc.sheet.live.pools[0].max = { derived: "chain" };
      },
      /Derived value "chain" reads the live state/,
      "and through two",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.sheet.live.pools[0].max = { skillMod: "soothe" }),
      /Skill "soothe" is capped by the live state, which this value cannot read/,
      "a pool's maximum through a skill a live value caps",
    );
    refuses(
      gravewatchText,
      (doc) => {
        doc.sheet.derived.push({ id: "soothing", label: "Soothing", op: "sum", of: [{ skillMod: "soothe" }] });
        doc.sheet.live.pools[0].max = { derived: "soothing" };
      },
      /Derived value "soothing" reads the live state, which this value cannot/,
      "and through a derived value that reads that skill",
    );
    refuses(
      emberText,
      (doc) => (doc.sheet.live.tracks[0].max = { livePool: "luck" }),
      /sheet\.live\.tracks\.0\.max\.livePool: This value is worked out without the live state/,
      "a track's maximum",
    );
    refuses(
      emberText,
      (doc) => {
        doc.resolution.proficiency = { bonus: { livePool: "luck" } };
      },
      /resolution\.proficiency\.bonus\.livePool: This value is worked out without the live state/,
      "the proficiency bonus",
    );
    // A cap feeds its own skill's number, so it reads no skill, and no derived chain that does.
    refuses(
      gravewatchText,
      (doc) => (doc.sheet.skills[0].cap = { skillMod: "ward" }),
      /A cap cannot read a skill or save modifier/,
      "a cap off a skill",
    );
    refuses(
      gravewatchText,
      (doc) => {
        doc.sheet.derived.unshift({ id: "warding", label: "Warding", op: "sum", of: [{ skillMod: "ward" }] });
        doc.sheet.derived.push({ id: "limit", label: "Limit", op: "sum", of: [{ const: 3 }] });
        doc.sheet.skills[0].cap = { derived: "limit" };
      },
      /"warding" feeds the cap on "dig" and cannot read a skill or save modifier/,
      "a cap off a derived chain that reads one",
    );
    // A list sum names a number column, and a boolean one to count by.
    refuses(
      emberText,
      (doc) => (doc.sheet.derived[2].of = [{ listSum: { list: "packs", column: "bulk" } }]),
      /Unknown list "packs"/,
      "a list the sheet does not have",
    );
    refuses(
      emberText,
      (doc) => (doc.sheet.derived[2].of = [{ listSum: { list: "gear", column: "weight" } }]),
      /"gear" has no column "weight"/,
      "a column the list does not have",
    );
    refuses(
      emberText,
      (doc) => (doc.sheet.derived[2].of = [{ listSum: { list: "gear", column: "name" } }]),
      /Column "name" is not a number/,
      "a text column",
    );
    refuses(
      emberText,
      (doc) => (doc.sheet.derived[2].of = [{ listSum: { list: "gear", column: "bulk", onlyWhen: "swing" } }]),
      /Column "swing" is not a boolean/,
      "counted by a column that is not a boolean",
    );
    // hideWhen says one thing, about values the field can hold.
    refuses(
      gravewatchText,
      (doc) => (doc.sheet.fields[2].hideWhen = { field: "watch", equals: "dusk", notEquals: "night" }),
      /hideWhen names exactly one of: equals, notEquals, in/,
      "two comparisons at once",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.sheet.fields[2].hideWhen = { field: "watch", notEquals: "noon" }),
      /sheet\.fields\.2\.hideWhen\.notEquals: "noon" is not one of the values of "watch"/,
      "a notEquals the field can never hold",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.sheet.fields[2].hideWhen = { field: "watch", in: ["dusk", "noon"] }),
      /sheet\.fields\.2\.hideWhen\.in\.1: "noon" is not one of the values of "watch"/,
      "one listed value the field can never hold, checked one at a time",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.sheet.fields[2].hideWhen = { field: "lantern", in: [1, "two"] }),
      /"lantern" is a number field, so in must be a number/,
      "a listed value of the wrong type",
    );
    refuses(
      gravewatchText,
      (doc) =>
        doc.layers.push({ id: "no_night", label: "No night", fields: [{ id: "watch", removeValues: ["night"] }] }),
      /"lantern" is shown only when "watch" is "night", so a layer cannot remove that value/,
      "a layer taking away the value a notEquals rule reads",
    );
    refuses(
      gravewatchText,
      (doc) => {
        doc.sheet.fields[2].hideWhen = { field: "watch", in: ["dusk", "dawn"] };
        doc.layers.push({ id: "no_dawn", label: "No dawn", fields: [{ id: "watch", removeValues: ["dawn"] }] });
      },
      /"lantern" is hidden when "watch" is "dawn", so a layer cannot remove that value/,
      "or one of the values an in rule lists",
    );
  }

  // ── Live values at their defaults, and as they stand ──
  {
    const build = warden();
    // No live state (the editor, an import review): Resolve starts full at 4, Harm starts clear.
    const fresh = evaluateRulesetSheetLive(gravewatch, build);
    assert.equal(fresh.derived.harm_left, 4);
    assert.deepEqual(fresh.skillCaps.soothe, { cap: 4, uncapped: 6 });
    assert.equal(fresh.skillMods.soothe, 4, "Soothe held to the Resolve the warden starts with");
    // Worked out without any live state at all, which only a maximum ever does, it reads 0.
    assert.equal(evaluateRulesetSheet(gravewatch, build).derived.harm_left, 0);

    // With it: one Resolve left and three knocks on a four-level track.
    const live = hurt(build, 1, 3);
    const now = evaluateRulesetSheetLive(gravewatch, build, live);
    assert.equal(now.derived.harm_left, 1, "one level of Harm left to take");
    assert.equal(now.skillMods.soothe, 1, "Soothe is down to the one Resolve left");
    assert.equal(now.skillMods.ward, fresh.skillMods.ward, "nothing uncapped moves");

    // Every read of a wound track, and of a plain one.
    const reads = (definition: RulesetDefinition, ref: Record<string, unknown>, stored?: unknown) =>
      evaluateRulesetSheetLive(
        variant(JSON.stringify(definitionDocument(definition)), (doc) =>
          doc.sheet.derived.push({ id: "probe", label: "Probe", op: "sum", of: [ref] }),
        ),
        defaultRulesetSheetBuild(definition),
        stored,
      ).derived.probe;
    const penaltyOnThird = gravewatch.sheet.live.tracks[0]!.levels![2]!.penalty;
    assert.equal(reads(gravewatch, { liveTrack: "harm" }, live), 3);
    assert.equal(reads(gravewatch, { liveTrack: "harm", read: "filled" }, live), 3);
    assert.equal(reads(gravewatch, { liveTrack: "harm", read: "remaining" }, live), 1);
    assert.equal(reads(gravewatch, { liveTrack: "harm", read: "penalty" }, live), penaltyOnThird);
    assert.ok(penaltyOnThird < 0, "the third rung costs something");
    assert.equal(reads(gravewatch, { liveTrack: "harm", read: "penalty" }), 0, "a clear track costs nothing");
    const heat = { tracks: { heat: 2 } };
    assert.equal(reads(ember, { liveTrack: "heat" }, heat), 2);
    assert.equal(reads(ember, { liveTrack: "heat", read: "filled" }, heat), 2);
    assert.equal(reads(ember, { liveTrack: "heat", read: "remaining" }, heat), 3);
    assert.equal(reads(ember, { livePool: "luck" }), 3, "a pool that starts full reads full");
    assert.equal(reads(ember, { livePool: "luck" }, { pools: { luck: { value: 1 } } }), 1);
    // A pool that starts empty reads 0, and one a field hides is not on the sheet.
    const empty = variant(emberText, (doc) => (doc.sheet.live.pools[1].start = "empty"));
    assert.equal(reads(empty, { livePool: "luck" }), 0);
    const hidden = variant(emberText, (doc) => {
      doc.sheet.fields.push({ id: "lucky", label: "Lucky", type: "boolean", default: false });
      doc.sheet.live.pools[1].hideWhen = { field: "lucky", equals: false };
    });
    assert.equal(reads(hidden, { livePool: "luck" }, { pools: { luck: { value: 2 } } }), 0);

    // `with=` swaps on the number before the cap, and the cap holds the result.
    const soothe = matchRulesetCheckTarget(gravewatch, "Soothe", "Nerve");
    assert.equal(rulesetCheckModifier(now, soothe), 1, "Nerve instead of Warmth, still one Resolve left");
    assert.equal(rulesetCheckModifier(fresh, soothe), 4, "6 - 3 + 2 = 5, capped at 4");
    // Below the cap the swap is simply the swap: Soothe at its first rating is 3 + 1, and with Nerve
    // 4 - 3 + 2 = 3, under a full Resolve of 4.
    const green = { ...build, skills: { ...build.skills, soothe: "rating_1" } };
    assert.equal(rulesetCheckModifier(evaluateRulesetSheetLive(gravewatch, green), soothe), 3);
  }

  // ── A list added up ──
  {
    const burden = (rows: unknown[], definition = ember) => {
      const build = defaultRulesetSheetBuild(definition);
      build.lists = { ...build.lists, gear: rows as never };
      return evaluateRulesetSheetLive(definition, build).derived;
    };
    assert.deepEqual(burden([]), { ...burden([]), burden: 0, burdened: 0 });
    const packed = burden([
      { name: "Anvil", bulk: 3 },
      { name: "Rope", bulk: 2, packed: true },
      { name: "Tent", bulk: 3, packed: false },
      { name: "Knife" },
    ]);
    assert.equal(packed.burden, 5, "the tent stays behind and a knife is no bulk at all");
    assert.equal(packed.burdened, -1);
    // An empty cell is its column's default: a variant where gear weighs one by default.
    const heavy = variant(
      emberText,
      (doc) => (doc.sheet.lists[0].columns.find((c: any) => c.id === "bulk").default = 1),
    );
    assert.equal(burden([{ name: "Knife" }, { name: "Lamp" }], heavy).burden, 2);
    // With no onlyWhen every row counts, and a list the sheet hides adds nothing.
    const all = variant(emberText, (doc) => delete doc.sheet.derived[2].of[0].listSum.onlyWhen);
    assert.equal(burden([{ name: "Tent", bulk: 3, packed: false }], all).burden, 3);
    const away = variant(emberText, (doc) => {
      doc.sheet.fields.push({ id: "travelling", label: "Travelling", type: "boolean", default: false });
      doc.sheet.lists[0].hideWhen = { field: "travelling", equals: false };
    });
    assert.equal(burden([{ name: "Anvil", bulk: 3 }], away).burden, 0);
  }

  // ── hideWhen, three ways ──
  {
    const lantern = gravewatch.sheet.fields.find((field) => field.id === "lantern")!;
    const on = (watch?: string) => {
      const build = defaultRulesetSheetBuild(gravewatch);
      if (watch) build.fields = { ...build.fields, watch };
      return isRulesetItemHidden(lantern, build, gravewatch);
    };
    assert.deepEqual([on(), on("night"), on("dusk"), on("dawn")], [false, false, true, true]);
    const listed = { hideWhen: { field: "watch", in: ["dusk", "dawn"] } };
    const build = defaultRulesetSheetBuild(gravewatch);
    assert.equal(isRulesetItemHidden(listed, build, gravewatch), false, "night is not listed");
    assert.equal(isRulesetItemHidden(listed, { ...build, fields: { watch: "dawn" } }, gravewatch), true);
    // A rule reads the value the editor shows: an unset field is the value a blank sheet starts
    // with, and an enum value the ruleset no longer offers is the field's default.
    assert.equal(on("noon"), false, "a stale value reads as night, which keeps the lantern");
    const undefaulted = variant(gravewatchText, (doc) => delete doc.sheet.fields[1].default);
    const unset = { ...defaultRulesetSheetBuild(undefaulted), fields: {} };
    const lanternOf = undefaulted.sheet.fields.find((field) => field.id === "lantern")!;
    assert.equal(isRulesetItemHidden(lanternOf, unset, undefaulted), true, "unset reads as dusk, the first value");
    const flag = variant(gravewatchText, (doc) => doc.sheet.fields.push({ id: "shy", label: "Shy", type: "boolean" }));
    assert.equal(
      isRulesetItemHidden({ hideWhen: { field: "shy", equals: false } }, { ...build, fields: {} }, flag),
      true,
      "an unset box is unticked",
    );
  }

  // ── The check reads the snapshot: the sheet number, a modifier off the sheet, a spend's limit ──
  {
    const build = warden();
    const live = hurt(build, 2, 3);
    const party = (definition: RulesetDefinition) => {
      const cards = [{ name: "Mira", rulesetSheet: { v: 1, build } }];
      return buildSkillCheckRulesetContext(definition, cards, cards[0], { mira: live });
    };
    assert.equal(rulesetCheckModifierFor(party(gravewatch), "Soothe"), 2, "two Resolve left, two dice");
    const reading = variant(gravewatchText, (doc) => {
      doc.resolution.adjust = [{ value: { liveTrack: "harm", read: "remaining" } }];
      doc.resolution.spend[0].perCheck = { livePool: "resolve" };
    });
    const context = party(reading);
    assert.equal(rulesetCheckAdjustFor(context, "Ward"), 1, "a modifier off the live track");
    const bought = planRulesetCheckPurchase(context, { pool: "resolve", amount: 5 }, undefined, 4);
    assert.deepEqual(bought?.spent, { pool: "resolve", amount: 2 }, "a spend limited to the Resolve there is");
  }

  // ── A fight reads the fighter's live state as the fight found it ──
  {
    const guarded = variant(emberText, (doc) => (doc.combat.defense = { livePool: "luck" }));
    const defense = (live?: unknown) =>
      rulesetCombatant(
        createRulesetEncounter({
          definition: guarded,
          seed: 7,
          combatants: [{ id: "juno", name: "Juno", side: "party", build: defaultRulesetSheetBuild(guarded), live }],
        }),
        "juno",
      )?.defense;
    assert.equal(defense(), 3);
    assert.equal(defense({ pools: { luck: { value: 1 } } }), 1);
  }

  // ── The reminder says where a spend's limit comes from ──
  {
    const base = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: [], playerName: "Mira" };
    const reminder = (perCheck: unknown) =>
      buildGmFormatReminder({
        ...base,
        ruleset: variant(gravewatchText, (doc) => {
          doc.sheet.lists[0].columns.push({ id: "weight", label: "Weight", type: "number", min: 0, max: 9 });
          doc.resolution.spend[0].perCheck = perCheck;
        }),
      });
    assert.match(reminder({ livePool: "resolve" }), /up to as many times per check as the Resolve left\./);
    assert.match(
      reminder({ liveTrack: "harm", read: "remaining" }),
      /up to as many times per check as how far Harm has left to go\./,
    );
    assert.match(
      reminder({ listSum: { list: "charms", column: "weight" } }),
      /up to as many times per check as the Weight of the sheet's Charms added up\./,
    );
  }

  // ── Every new key needs 1.39 to install ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
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
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const issue = /requires schemaVersion 2 and capabilityApi 1\.39 or newer/;
    const documents = [
      { sheet: { derived: [{ id: "x", label: "X", op: "sum", of: [{ liveTrack: "harm", read: "remaining" }] }] } },
      { sheet: { derived: [{ id: "x", label: "X", op: "sum", of: [{ livePool: "resolve" }] }] } },
      { sheet: { derived: [{ id: "x", label: "X", op: "sum", of: [{ listSum: { list: "gear", column: "bulk" } }] }] } },
      { sheet: { skills: [{ id: "soothe", label: "Soothe", cap: { const: 3 } }] } },
      { sheet: { saves: [{ id: "grit", label: "Grit", cap: { const: 3 } }] } },
      {
        sheet: {
          fields: [{ id: "x", label: "X", type: "number", min: 0, max: 1, hideWhen: { field: "k", notEquals: "a" } }],
        },
      },
      { sheet: { live: { pools: [{ id: "p", label: "P", max: { const: 1 }, hideWhen: { field: "k", in: ["a"] } }] } } },
      { resolution: { kind: "dice-sum", adjust: [{ value: { livePool: "luck" } }] } },
    ];
    for (const document of documents) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(38) as never, document) ?? "",
        issue,
        JSON.stringify(document),
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(39) as never, document), null);
    }
    // What every file before 1.39 could say needs nothing new: a one-value hideWhen, and the combat
    // block's own `{ "pool": ... }`, which is not a live read.
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(37) as never, {
        sheet: {
          fields: [{ id: "x", label: "X", type: "number", min: 0, max: 1, hideWhen: { field: "k", equals: "a" } }],
        },
      }),
      null,
    );
    // And a list sum in a catalog file the ruleset names is read there too.
    const paths = ["ruleset.json", "catalogs/gear.json"];
    const files = new Map([
      [
        "catalogs/gear.json",
        {
          entries: [
            {
              id: "e",
              label: "E",
              rows: [
                {
                  list: "gear",
                  values: {},
                  scaled: { bulk: { from: { listSum: { list: "gear", column: "bulk" } }, table: [[0, 0]] } },
                },
              ],
            },
          ],
        },
      ],
    ]);
    const header = { catalogs: [{ id: "gear", label: "Gear", feeds: ["gear"], asset: "catalogs/gear.json" }] };
    assert.match(getCapabilityPackageInstallIssue(manifest(38, paths) as never, header, files) ?? "", issue);
    assert.equal(getCapabilityPackageInstallIssue(manifest(39, paths) as never, header, files), null);
  }

  console.info("game ruleset sheet-read regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}

/** A parsed definition back as a document a variant can be cut from. Parsing only fills defaults,
 *  so the document parses back to the same definition. */
function definitionDocument(definition: RulesetDefinition): Record<string, unknown> {
  return JSON.parse(JSON.stringify(definition)) as Record<string, unknown>;
}
