/**
 * Game Mode rulesets, slice 6 (#6656): live states, the numbers that follow them, and rests that put
 * them back.
 *
 * What is pinned here:
 *   - `sheet.live.states`: one value out of a closed set that changes in play. Stored sparse, read as
 *     its default when nothing (or a value it no longer offers) is stored, left off a sheet that
 *     hides it.
 *   - `op="state"` sets one by its id or label, to a value or its label; `unknown-state` and
 *     `unknown-value` refuse. The tag reads, writes and reports it, and a condition's `state=` still
 *     means on or off.
 *   - `enumTable`: a number per value of an enum field or a live state. A field's table may feed a
 *     maximum; a state's is a live read, refused wherever a live read is, directly or through a
 *     derived value. It reaches the dice through `resolution.adjust`, on both kinds.
 *   - A rest step `{ state, to }` puts a state back, to its default or a named value.
 *   - The Game Master's sheet block says each state; the reminder teaches the command and lists
 *     the values, and neither appears for a ruleset without states.
 *   - Every import refusal, a layer's interplay with a field-keyed table, the stored blob's bounds,
 *     and the 1.42 gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetLayers,
  applyRulesetSheetOp,
  applySheetCommandTags,
  defaultRulesetSheetBuild,
  evaluateRulesetSheetLive,
  matchRulesetCheckTarget,
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  readResolvedSheetCommandTags,
  readRulesetLive,
  renderRulesetSheetBlock,
  rulesetCheckAdjust,
  rulesetLiveStatesSchema,
  serializeSheetCommandTag,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-live-states-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const [
    { buildSkillCheckRulesetContext, resolveSkillCheckWithContext },
    { buildGmFormatReminder },
    { getCapabilityPackageInstallIssue },
    { renderGameRulesetSheetBlocks },
  ] = await Promise.all([
    import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js"),
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
  const fiveE = parsedOrThrow(JSON.parse(fiveEText), "the 5e reference");
  const stateOf = (doc: Record<string, any>) => doc.sheet.live.states[0];
  const derivedOf = (doc: Record<string, any>, id: string) =>
    doc.sheet.derived.find((entry: { id: string }) => entry.id === id);
  const emberBuild = defaultRulesetSheetBuild(ember);
  const graveBuild = defaultRulesetSheetBuild(gravewatch);

  // ── Refused at import ──
  {
    refuses(
      emberText,
      (doc) => (stateOf(doc).default = "frantic"),
      /default "frantic" is not one of the values/,
      "a default it does not offer",
    );
    refuses(
      emberText,
      (doc) => doc.sheet.live.states.push({ ...stateOf(doc) }),
      /Duplicate state id "stance"/,
      "two states under one id",
    );
    refuses(emberText, (doc) => stateOf(doc).values.push("steady"), /Duplicate value "steady"/, "a value twice");
    refuses(
      emberText,
      (doc) => (stateOf(doc).valueLabels.frantic = "Frantic"),
      /"frantic" is not one of the values/,
      "a label for a value it does not have",
    );
    refuses(
      emberText,
      (doc) => (stateOf(doc).values = ["steady"]),
      /at least 2|>=2|too_small|Array must contain at least 2/i,
      "one value is not a choice",
    );
    refuses(
      emberText,
      (doc) => (stateOf(doc).values[2] = 'the "wild" one'),
      /cannot contain a double quote/,
      "a value the command could not quote",
    );
    refuses(
      emberText,
      (doc) => (stateOf(doc).values[2] = "[reckless]"),
      /square brackets/,
      "a value shaped like a tag",
    );
    refuses(
      emberText,
      (doc) => (derivedOf(doc, "stance_brawn").from = { liveState: "stance", field: "calling" }),
      /exactly one of: field, liveState/,
      "a table keyed on two things",
    );
    refuses(
      emberText,
      (doc) => (derivedOf(doc, "stance_brawn").from = {}),
      /exactly one of: field, liveState/,
      "a table keyed on nothing",
    );
    refuses(
      emberText,
      (doc) => (derivedOf(doc, "stance_brawn").from = { liveState: "mood" }),
      /Unknown state "mood"/,
      "an unknown state",
    );
    refuses(
      emberText,
      (doc) => (derivedOf(doc, "stance_brawn").from = { field: "nowhere" }),
      /Unknown field "nowhere"/,
      "an unknown field",
    );
    refuses(
      emberText,
      (doc) => (derivedOf(doc, "stance_brawn").from = { field: "toughness" }),
      /Field "toughness" is not an enum/,
      "a number field",
    );
    refuses(
      emberText,
      (doc) => (derivedOf(doc, "stance_brawn").table.frantic = 3),
      /"frantic" is not one of the values of "stance"/,
      "a row no sheet could ever read",
    );
    refuses(
      gravewatchText,
      (doc) => (derivedOf(doc, "dawn_resolve").table.noon = 1),
      /"noon" is not one of the values of "watch"/,
      "a field's row no sheet could ever read",
    );
    refuses(emberText, (doc) => (derivedOf(doc, "stance_brawn").table = {}), /from 1 to 40 values/, "an empty table");
    // A state changes in play, so a maximum may not follow it: not directly, and not through a sum.
    refuses(
      gravewatchText,
      (doc) => derivedOf(doc, "resolve_max").of.push({ derived: "light_nerve" }),
      /must be declared above|reads the live state/,
      "a maximum following a live state",
    );
    refuses(
      gravewatchText,
      (doc) => {
        const light = doc.sheet.derived.splice(
          doc.sheet.derived.findIndex((entry: { id: string }) => entry.id === "light_nerve"),
          1,
        )[0];
        doc.sheet.derived.unshift(light, {
          id: "dark_sum",
          label: "Dark",
          op: "sum",
          of: [{ derived: "light_nerve" }],
        });
        doc.sheet.live.pools[0].max = { derived: "dark_sum" };
      },
      /Derived value "dark_sum" reads the live state/,
      "a maximum following a live state through a sum",
    );
    // A rest step names a real state, and puts it on a value it has.
    refuses(
      emberText,
      (doc) => (doc.rests[0].restore.at(-1).state = "mood"),
      /Unknown state "mood"/,
      "a rest on an unknown state",
    );
    refuses(
      emberText,
      (doc) => (doc.rests[0].restore.at(-1).to = "frantic"),
      /"frantic" is not "default" or one of the values of "stance"/,
      "a rest to a value it does not have",
    );
    refuses(
      emberText,
      (doc) => (doc.rests[0].restore.at(-1).to = 2),
      /"to": "default" or one of its values/,
      "a number on a state",
    );
    refuses(
      emberText,
      (doc) => doc.rests[0].restore.splice(-1, 1, { state: "stance", by: { const: 1 } }),
      /"to": "default" or one of its values/,
      "a state is not moved by an amount",
    );
    refuses(
      emberText,
      (doc) => (doc.rests[0].restore[0].to = "most"),
      /"to" is "max", "min" or a number/,
      "a word on a pool",
    );
    // A layer may not take away a value something shows or hides on, and a state is such a thing.
    refuses(
      gravewatchText,
      (doc) => {
        stateOf(doc).hideWhen = { field: "watch", equals: "dawn" };
        doc.layers.push({ id: "no_dawn", label: "No dawn", fields: [{ id: "watch", removeValues: ["dawn"] }] });
      },
      /"light" is hidden when "watch" is "dawn", so a layer cannot remove that value/,
      "a layer removing the value a state hides on",
    );
  }

  // ── A layer may take away a value a field's table has a row for ──
  {
    const layered = variant(gravewatchText, (doc) =>
      doc.layers.push({ id: "no_dawn", label: "No dawn", fields: [{ id: "watch", removeValues: ["dawn"] }] }),
    );
    const effective = applyRulesetLayers(layered, { "layer.no_dawn": true });
    assert.notEqual(effective, layered, "the layer applies");
    assert.deepEqual(
      effective.sheet.fields.find((field) => field.id === "watch")?.type === "enum"
        ? (effective.sheet.fields.find((field) => field.id === "watch") as { values: string[] }).values
        : [],
      ["dusk", "night"],
      "the table's dawn row does not keep the layer from applying",
    );
  }

  // ── What a state reads as ──
  {
    const at = (stored: unknown) => readRulesetLive(ember, emberBuild, stored).states;
    assert.deepEqual(at(undefined), [
      {
        id: "stance",
        label: "Stance",
        values: ["guarded", "steady", "reckless"],
        valueLabels: { guarded: "Guarded", steady: "Steady", reckless: "Reckless" },
        value: "steady",
        valueLabel: "Steady",
      },
    ]);
    assert.equal(at({ states: { stance: "reckless" } })[0]!.value, "reckless");
    assert.equal(
      at({ states: { stance: "frantic" } })[0]!.value,
      "steady",
      "a value it no longer offers reads as the default",
    );
    assert.equal(at({ states: { stance: 3 } })[0]!.value, "steady", "junk reads as the default");
    // With no default declared, the first value.
    const firstFirst = variant(emberText, (doc) => delete stateOf(doc).default);
    assert.equal(readRulesetLive(firstFirst, emberBuild, undefined).states[0]!.value, "guarded");
    // A state the sheet hides is not on it.
    const hidden = variant(gravewatchText, (doc) => (stateOf(doc).hideWhen = { field: "watch", equals: "night" }));
    assert.deepEqual(readRulesetLive(hidden, graveBuild, undefined).states, []);
  }

  // ── The numbers that follow ──
  {
    const stance = (value?: string) =>
      evaluateRulesetSheetLive(ember, emberBuild, value ? { states: { stance: value } } : undefined).derived
        .stance_brawn;
    assert.deepEqual([stance(), stance("steady"), stance("guarded"), stance("reckless")], [0, 0, -1, 2]);
    // Keyed on a field, fixed at creation, so a maximum may read it: a dawn warden has one more Resolve.
    const resolveMax = (watch: string) =>
      readRulesetLive(gravewatch, { ...graveBuild, fields: { ...graveBuild.fields, watch } }, undefined).pools[0]!.max;
    assert.deepEqual([resolveMax("night"), resolveMax("dusk"), resolveMax("dawn")], [4, 4, 5]);
    // A hidden state reads the table's default.
    const hidden = variant(gravewatchText, (doc) => {
      stateOf(doc).hideWhen = { field: "watch", equals: "night" };
      derivedOf(doc, "light_nerve").default = 7;
    });
    assert.equal(evaluateRulesetSheetLive(hidden, graveBuild, { states: { light: "out" } }).derived.light_nerve, 7);

    // Through `adjust` to the dice, on both kinds, limited to the ability it names.
    const adjustOn = (definition: RulesetDefinition, build: RulesetSheetBuild, live: RulesetLiveState, check: string) =>
      rulesetCheckAdjust(
        definition,
        build,
        evaluateRulesetSheetLive(definition, build, live),
        matchRulesetCheckTarget(definition, check),
      );
    assert.equal(adjustOn(ember, emberBuild, { states: { stance: "reckless" } }, "Brawn"), 2);
    assert.equal(adjustOn(ember, emberBuild, { states: { stance: "reckless" } }, "Wits"), 0, "Brawn only");
    assert.equal(adjustOn(gravewatch, graveBuild, { states: { light: "out" } }, "Listen"), -2, "a Nerve skill");
    assert.equal(adjustOn(gravewatch, graveBuild, { states: { light: "out" } }, "Dig"), 0, "a Sinew skill");

    // And into a real check: the context carries each character's live state.
    const context = (definition: RulesetDefinition, build: RulesetSheetBuild, live: RulesetLiveState) => {
      const party = [{ name: "Juno", rulesetSheet: { v: 1, build } }];
      return {
        skills: null,
        attributes: null,
        sheetAttributes: {},
        ruleset: buildSkillCheckRulesetContext(definition, party, party[0], { juno: live }),
      } satisfies SkillCheckModifierContext;
    };
    const reckless = resolveSkillCheckWithContext(context(ember, emberBuild, { states: { stance: "reckless" } }), {
      skill: "Brawn",
      dc: 8,
    });
    const steady = resolveSkillCheckWithContext(context(ember, emberBuild, {}), { skill: "Brawn", dc: 8 });
    assert.equal(reckless.modifier - steady.modifier, 2, "throwing caution away is two on the roll");
  }

  // ── The command ──
  {
    const set = (stored: unknown, state: string, value: string) =>
      applyRulesetSheetOp(ember, emberBuild, stored, { op: "state", state, value });
    const reckless = set(undefined, "stance", "reckless");
    assert.deepEqual(reckless, { ok: true, live: { states: { stance: "reckless" } }, now: "Stance Reckless" });
    assert.deepEqual(
      set(undefined, "STANCE", "Guarded"),
      {
        ok: true,
        live: { states: { stance: "guarded" } },
        now: "Stance Guarded",
      },
      "by label, either way round, without case",
    );
    assert.deepEqual(
      set({ states: { stance: "reckless" } }, "stance", "steady"),
      { ok: true, live: {}, now: "Stance Steady" },
      "back at its default, nothing is stored",
    );
    assert.deepEqual(set(undefined, "Mood", "Calm"), { ok: false, reason: "unknown-state" });
    assert.deepEqual(set(undefined, "Stance", "Frantic"), { ok: false, reason: "unknown-value" });
    const hidden = variant(gravewatchText, (doc) => (stateOf(doc).hideWhen = { field: "watch", equals: "night" }));
    assert.deepEqual(
      applyRulesetSheetOp(hidden, graveBuild, undefined, { op: "state", state: "Light", value: "Out" }),
      { ok: false, reason: "unknown-state" },
      "a hidden state is not on the sheet to set",
    );
    // Other live values are left exactly where they were.
    const beside = set({ pools: { grit: { value: 3 } }, conditions: ["shaken"] }, "stance", "reckless");
    assert.deepEqual(beside.ok && beside.live, {
      pools: { grit: { value: 3 } },
      conditions: ["shaken"],
      states: { stance: "reckless" },
    });

    // The tag: read, written back and reported. `state=` names the state here and is on/off on a condition.
    const parsed = parseSheetCommandTagBody(` who="Juno" op="state" state="Stance" value="Reckless"`);
    assert.deepEqual(parsed, { who: "Juno", op: { op: "state", state: "Stance", value: "Reckless" } });
    assert.equal(parseSheetCommandTagBody(` op="state" state="Stance"`).op, null, "no value, no command");
    assert.deepEqual(parseSheetCommandTagBody(` op="condition" condition="Shaken" state="off"`).op, {
      op: "condition",
      condition: "Shaken",
      active: false,
    });
    const written = serializeSheetCommandTag(
      { who: "Juno", op: parsed.op, raw: "" },
      { ok: true, now: "Stance Reckless" },
    );
    assert.equal(
      written,
      `[sheet: who="Juno" op="state" state="Stance" value="Reckless" result="ok" now="Stance Reckless"]`,
    );
    assert.deepEqual(
      readResolvedSheetCommandTags(written).map((entry) => entry.summary),
      ["Juno state Stance -> Stance Reckless"],
    );
    const condition = serializeSheetCommandTag(
      { op: { op: "condition", condition: "Shaken", active: true }, raw: "" },
      { ok: true, now: "Shaken on" },
    );
    assert.deepEqual(
      readResolvedSheetCommandTags(condition).map((entry) => entry.summary),
      ["condition Shaken -> Shaken on"],
    );

    // Through a whole turn, as the Game Master writes it.
    const turn = applySheetCommandTags(
      `Juno squares up. [sheet: who="Juno" op="state" state="Stance" value="Reckless"] [sheet: who="Juno" op="state" state="Stance" value="Frantic"]`,
      { definition: ember, cards: [{ name: "Juno", build: emberBuild }], playerName: "Juno", live: {} },
    );
    assert.deepEqual(turn.live, { juno: { states: { stance: "reckless" } } });
    assert.match(turn.content, /value="Reckless" result="ok" now="Stance Reckless"/);
    assert.match(turn.content, /value="Frantic" result="refused" reason="unknown-value"/);
  }

  // ── A rest puts it back ──
  {
    const camp = applyRulesetSheetOp(
      ember,
      emberBuild,
      { states: { stance: "reckless" } },
      { op: "rest", rest: "camp" },
    );
    assert.ok(camp.ok);
    assert.equal(camp.live.states, undefined, "back at its default");
    assert.match(camp.now, /^Make camp: .*Stance Steady/);
    const already = applyRulesetSheetOp(ember, emberBuild, undefined, { op: "rest", rest: "camp" });
    assert.ok(already.ok && !/Stance/.test(already.now), "a state already there is not said to have moved");
    // To a named value rather than the default.
    const named = variant(emberText, (doc) => (doc.rests[0].restore.at(-1).to = "guarded"));
    const rested = applyRulesetSheetOp(named, emberBuild, undefined, { op: "rest", rest: "camp" });
    assert.deepEqual(rested.ok && rested.live.states, { stance: "guarded" });
    // Gravewatch's vigil relights the lantern, and a breather leaves it as it is.
    const vigil = applyRulesetSheetOp(
      gravewatch,
      graveBuild,
      { states: { light: "out" } },
      { op: "rest", rest: "vigil" },
    );
    assert.equal(vigil.ok && vigil.live.states, undefined);
    const breather = applyRulesetSheetOp(
      gravewatch,
      graveBuild,
      { states: { light: "out" } },
      { op: "rest", rest: "breather" },
    );
    assert.deepEqual(breather.ok && breather.live.states, { light: "out" });
  }

  // ── What the Game Master is told ──
  {
    const block = renderRulesetSheetBlock(
      ember,
      { name: "Juno", build: emberBuild },
      { states: { stance: "reckless" } },
    );
    assert.match(block, /^Stance Reckless$/m);
    assert.match(
      renderRulesetSheetBlock(ember, { name: "Juno", build: emberBuild }, {}),
      /^Stance Steady$/m,
      "said at its default too",
    );
    assert.doesNotMatch(
      renderRulesetSheetBlock(fiveE, { name: "Vex", build: defaultRulesetSheetBuild(fiveE) }, {}),
      /Stance/,
    );

    const base = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: [], playerName: "Juno" };
    const reminder = buildGmFormatReminder({
      ...base,
      ruleset: ember,
      rulesetSheetBlocks: renderGameRulesetSheetBlocks(ember, [{ name: "Juno" }], null),
    });
    assert.match(
      reminder,
      /- \[sheet: who="Name" op="state" state="State" value="Value"\] - sets a state to one of its values\./,
    );
    assert.match(reminder, /^States: Stance \(Guarded, Steady, Reckless\)\.$/m);
    const none = buildGmFormatReminder({
      ...base,
      ruleset: fiveE,
      rulesetSheetBlocks: renderGameRulesetSheetBlocks(fiveE, [{ name: "Juno" }], null),
    });
    assert.doesNotMatch(none, /op="state"|^States:/m, "only where a ruleset has states");
  }

  // ── What may be stored ──
  {
    assert.ok(rulesetLiveStatesSchema.safeParse({ juno: { states: { stance: "reckless" } } }).success);
    assert.ok(!rulesetLiveStatesSchema.safeParse({ juno: { states: { stance: "x".repeat(81) } } }).success);
    const many = Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`s${index}`, "a"]));
    assert.ok(!rulesetLiveStatesSchema.safeParse({ juno: { states: many } }).success, "far past any sheet");
  }

  // ── Every new key needs 1.42 to install ──
  {
    assert.equal(supportedCapabilityApi.minor, 42);
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
    const issue = /requires schemaVersion 2 and capabilityApi 1\.42 or newer/;
    const documents = [
      { sheet: { live: { states: [{ id: "s", label: "S", values: ["a", "b"] }] } } },
      { sheet: { derived: [{ id: "d", label: "D", op: "enumTable", from: { field: "f" }, table: { a: 1 } }] } },
      { rests: [{ id: "r", label: "R", restore: [{ state: "s", to: "default" }] }] },
    ];
    for (const document of documents) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(41) as never, document) ?? "",
        issue,
        JSON.stringify(document),
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(42) as never, document), null);
    }
    // Nothing else a 1.41 file could say is held back.
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(41) as never, {
        sheet: {
          live: { conditions: [{ id: "c", label: "C" }] },
          derived: [{ id: "d", label: "D", op: "sum", of: [] }],
        },
        rests: [{ id: "r", label: "R", restore: [{ pool: "p", to: "max" }] }],
      }),
      null,
    );
  }

  console.info("game ruleset live state regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
