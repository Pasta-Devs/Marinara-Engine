/**
 * Ruleset layers (L1): variants a ruleset ships INSIDE its own file, turned on when a game is
 * created and frozen into the pin.
 *
 * What is pinned here:
 *   - The format is not shaped around one game system. All three shipped examples carry a layer:
 *     a 2d6 ruleset, a ten-sided pool ruleset and the 5e draft, and the pool one swaps a ladder of
 *     successes where the summed ones swap a ladder of DCs.
 *   - Every effect narrows or appends. Enum values are only ever removed, the ladder is replaced by
 *     a ladder of the SAME kind, guidance is added after the ruleset's own, and catalog entries are
 *     hidden from the picker without the ruleset's own entries being rewritten.
 *   - The result is still a ruleset the rest of the Engine can read, and a layer whose result would
 *     not validate is skipped rather than costing the game its rules.
 *   - `resolveGameRuleset` hands every caller the LAYERED definition, and `/game/create` refuses a
 *     selection this ruleset cannot honour instead of quietly dropping it.
 *   - Layers and the base `gm.worldGuidance` slot are Capability API 1.25.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  activeRulesetLayers,
  applyRulesetLayers,
  resolveRulesetLayers,
  catalogEntryHiddenByLayers,
  parseRulesetDefinition,
  rulesetEffectiveDefinitionSchema,
  rulesetLayerOptionKey,
  rulesetLayerSelectionIssues,
  supportedCapabilityApi,
  RULESET_LAYER_GUIDANCE_MAX,
  RULESET_LAYERS_MAX,
  RULESET_REF_MAX_OPTIONS,
  type GameSetupConfig,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
/** The example less the sheet keys 1.37 added (a track always shown, a summary list's columns):
 *  every gate this lane proves is older, so it is proven on a file that trips nothing newer. */
const emberText = (() => {
  const doc = JSON.parse(read("../../docs/examples/rulesets/ember-roads.json"));
  for (const track of doc.sheet.live.tracks) delete track.alwaysShow;
  for (const list of doc.gm.sheetSummary?.lists ?? []) delete list.columns;
  return JSON.stringify(doc);
})();
const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");

const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
};
/** One of the shipped examples, optionally edited first. */
const variant = (text: string, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  return doc;
};
const ember = parsedOrThrow(variant(emberText), "the 2d6 example");
const gravewatch = parsedOrThrow(variant(gravewatchText), "the pool example");
const fiveE = parsedOrThrow(variant(fiveEText), "the 5e example");

const on = (...ids: string[]) => Object.fromEntries(ids.map((id) => [rulesetLayerOptionKey(id), true]));

// ── All three examples ship a layer, and none of them is 5e-shaped ──
{
  assert.equal(rulesetLayerOptionKey("hard_winter"), "layer.hard_winter");
  assert.deepEqual(
    ember.layers!.map((layer) => layer.id),
    ["hard_winter"],
  );
  assert.deepEqual(
    gravewatch.layers!.map((layer) => layer.id),
    ["long_night"],
  );
  assert.deepEqual(
    fiveE.layers!.map((layer) => layer.id),
    ["low_magic", "high_magic"],
  );
  assert.deepEqual(fiveE.layers![0]!.conflicts, ["high_magic"], "the shipped examples carry a conflicting pair");
  // The pool example's layer swaps successes, the summed ones swap DCs. A format shaped around one
  // system could not do both.
  assert.ok(gravewatch.layers![0]!.difficultyLadder!.every((step) => "successes" in step));
  assert.ok(ember.layers![0]!.difficultyLadder!.every((step) => "dc" in step));
  // World guidance is a slot base rulesets gained in the same release, and none of the shipped
  // examples declares one at the base: it arrives with the layer that needs it.
  assert.equal(ember.gm.worldGuidance, undefined);
  assert.ok(ember.layers![0]!.gm!.worldGuidance);
}

// ── Schema refusals: a layer that named something the ruleset does not have ──
{
  const refuses = (text: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
    const parsed = parseRulesetDefinition(variant(text, edit));
    assert.ok(!parsed.ok, `expected a refusal: ${why}`);
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(parsed.issues)}`,
    );
  };
  const ember5 = (edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) =>
    refuses(emberText, edit, pattern, why);
  const fiveEdit = (edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) =>
    refuses(fiveEText, edit, pattern, why);

  ember5(
    (doc) => doc.layers.push({ ...doc.layers[0] }),
    /layers\.1\.id: Duplicate layer id "hard_winter"/,
    "two layers cannot share an id",
  );
  ember5(
    (doc) => (doc.layers[0].conflicts = ["hard_winter"]),
    /layers\.0\.conflicts\.0: A layer cannot conflict with itself/,
    "a layer that conflicts with itself could never be turned on",
  );
  ember5(
    (doc) => (doc.layers[0].conflicts = ["mud_season"]),
    /layers\.0\.conflicts\.0: Unknown layer "mud_season"/,
    "a conflict names a layer this file has",
  );
  ember5(
    (doc) => {
      doc.layers = Array.from({ length: RULESET_LAYERS_MAX + 1 }, (_, index) => ({
        ...doc.layers[0],
        id: `layer_${index}`,
      }));
    },
    /^layers: /,
    `a ruleset offers at most ${RULESET_LAYERS_MAX} layers`,
  );
  ember5(
    (doc) => (doc.layers[0].gm.guidance = `${"a".repeat(RULESET_LAYER_GUIDANCE_MAX)}.`),
    /^layers\.0\.gm\.guidance: /,
    "one layer's guidance has a ceiling of its own",
  );
  ember5(
    (doc) => {
      doc.layers[0].gm.guidance = "a".repeat(RULESET_LAYER_GUIDANCE_MAX - 10);
      doc.layers[0].gm.worldGuidance = "b".repeat(20);
    },
    /layers\.0\.gm: One layer carries at most 4000 characters of guidance in total/,
    "the ceiling is on everything one toggle adds to a prompt, not on each string",
  );
  ember5(
    (doc) => (doc.layers[0].gm.guidance = "Winter bites.\nHard."),
    /^layers\.0\.gm\.guidance: Text cannot contain line breaks/,
    "layer guidance follows the same prompt hygiene as the ruleset's own",
  );
  ember5(
    (doc) => (doc.layers[0].gm.worldGuidance = "Use [bg: winter] everywhere."),
    /^layers\.0\.gm\.worldGuidance: Text cannot contain square brackets/,
    "and so does the world-generation half",
  );

  // Fields: an enum is narrowed, and only an enum.
  fiveEdit(
    (doc) => (doc.layers[0].fields[0].id = "vocation"),
    /layers\.0\.fields\.0\.id: Unknown field "vocation"/,
    "a layer narrows a field the sheet declares",
  );
  fiveEdit(
    (doc) => (doc.layers[0].fields[0] = { id: "level", removeValues: ["1"] }),
    /layers\.0\.fields\.0\.id: Field "level" is not an enum/,
    "there is nothing to remove from a number",
  );
  fiveEdit(
    (doc) => doc.layers[0].fields[0].removeValues.push("psi"),
    /layers\.0\.fields\.0\.removeValues\.2: "psi" is not one of the values of "spellcasting_ability"/,
    "a value that is not there cannot be removed",
  );
  fiveEdit(
    (doc) => (doc.layers[0].fields[0] = { id: "spellcasting_ability", removeValues: ["none", "int", "wis", "cha"] }),
    /layers\.0\.fields\.0\.removeValues: A layer must leave "spellcasting_ability" at least one value/,
    "a field with nothing left could never be filled in",
  );
  fiveEdit(
    (doc) => (doc.layers[0].fields[0] = { id: "spellcasting_ability", removeValues: ["none"] }),
    /layers\.0\.fields\.0\.removeValues: Removing "none" takes the default of "spellcasting_ability" away/,
    "a default the layer removes leaves every sheet on a value the field no longer lists",
  );
  // The sheet hides its spell fields while the ability is "none". With that value gone the rule
  // could never match, the layered ruleset would not validate, and the layer would be skipped in
  // play with nobody told, so the file is refused instead.
  fiveEdit(
    (doc) => (doc.layers[0].fields[0] = { id: "spellcasting_ability", removeValues: ["none"], default: "wis" }),
    /layers\.0\.fields\.0\.removeValues\.0: ".+" is hidden when "spellcasting_ability" is "none", so a layer cannot remove that value/,
    "a value a hideWhen rule reads cannot be removed",
  );
  fiveEdit(
    (doc) => (doc.layers[0].fields[0] = { id: "spellcasting_ability", removeValues: ["none"], default: "none" }),
    /layers\.0\.fields\.0\.default: default "none" is not one of the values this layer leaves/,
    "and a replacement default has to survive the same layer",
  );
  fiveEdit(
    (doc) => doc.layers[0].fields.push({ id: "spellcasting_ability", removeValues: ["wis"] }),
    /layers\.0\.fields\.1\.id: Duplicate narrowed field id "spellcasting_ability"/,
    "one layer narrows a field once, so its default is never ambiguous",
  );

  // The ladder is the base kind's, wherever it appears.
  ember5(
    (doc) => (doc.layers[0].difficultyLadder = [{ label: "Grim", successes: 3 }]),
    /layers\.0\.difficultyLadder\.0: This ruleset sums dice, so a ladder step names "dc"/,
    "a pool ladder on a summed ruleset is a rung nothing could read",
  );
  refuses(
    gravewatchText,
    (doc) => (doc.layers[0].difficultyLadder = [{ label: "Grim", dc: 14 }]),
    /layers\.0\.difficultyLadder\.0: This ruleset throws a pool, so a ladder step names "successes"/,
    "and the other way round",
  );
  refuses(
    gravewatchText,
    (doc) => (doc.layers[0].difficultyLadder[0].successes = 99),
    /layers\.0\.difficultyLadder\.0\.successes: The largest pool can count 30 at most/,
    "a layer's ladder passes the pool's own reachability check",
  );
  refuses(
    gravewatchText,
    (doc) => (doc.layers[0].difficultyLadder[0].target = 3),
    /layers\.0\.difficultyLadder\.0\.target: A step's target is inside 5 to 9/,
    "and its target check",
  );

  // Catalogs: the picker filter has to be one the catalog declares, of a type the comparison fits.
  ember5(
    (doc) => (doc.layers[0].catalogs[0].id = "spells"),
    /layers\.0\.catalogs\.0\.id: Unknown catalog "spells"/,
    "a layer hides entries out of a catalog this ruleset has",
  );
  ember5(
    (doc) => (doc.layers[0].catalogs[0].hide = { filter: "cost", above: 1 }),
    /layers\.0\.catalogs\.0\.hide\.filter: Catalog "knacks" declares no filter "cost"/,
    "and by a filter the catalog declares",
  );
  ember5(
    (doc) => (doc.layers[0].catalogs[0].hide = { filter: "grit", equals: "0" }),
    /layers\.0\.catalogs\.0\.hide: Filter "grit" holds a number, so hide uses above or below/,
    "comparing a number with a word would match nothing",
  );
  ember5(
    (doc) => (doc.layers[0].catalogs[0].hide = { filter: "road", above: 1 }),
    /layers\.0\.catalogs\.0\.hide: Filter "road" holds words, so hide uses equals or notIn/,
    "and the other way round",
  );
  ember5(
    (doc) => (doc.layers[0].catalogs[0].hide = { filter: "grit", above: 1, below: 5 }),
    /layers\.0\.catalogs\.0\.hide: A hide rule names exactly one of: above, below, equals, notIn/,
    "one comparison per rule, so what it hides is never a guess",
  );
  ember5(
    (doc) => (doc.layers[0].catalogs[0].hide = { filter: "grit" }),
    /layers\.0\.catalogs\.0\.hide: A hide rule names exactly one of: above, below, equals, notIn/,
    "and a rule with none hides nothing",
  );
  ember5(
    (doc) => (doc.layers[0].what = "winter"),
    /^layers\.0: Unrecognized key/,
    "the layer block is strict like the rest of the file",
  );
}

// ── Application ──
{
  // Nothing turned on is the same object, so a game without layers is the game it always was.
  assert.equal(applyRulesetLayers(ember, {}), ember);
  assert.equal(applyRulesetLayers(ember, undefined), ember);
  assert.equal(applyRulesetLayers(ember, { "layer.hard_winter": false }), ember);
  assert.equal(applyRulesetLayers(ember, { "layer.mud_season": true }), ember, "an unknown layer id is ignored");
  assert.equal(applyRulesetLayers(fiveE, { difficulty: "brutal", seed: 4 }), fiveE, "so are foreign keys");

  // Ember Roads: a harsher ladder, guidance appended after the ruleset's own, a world slot that the
  // base did not have, and a picker that leaves the knacks nobody can pay for out.
  const winter = applyRulesetLayers(ember, on("hard_winter"));
  assert.notEqual(winter, ember);
  assert.deepEqual(winter.resolution.difficultyLadder, [
    { label: "Easy", dc: 7 },
    { label: "Risky", dc: 9 },
    { label: "Hard", dc: 11 },
    { label: "Desperate", dc: 13 },
  ]);
  assert.equal(winter.gm.checkGuidance, `${ember.gm.checkGuidance} ${ember.layers![0]!.gm!.guidance}`);
  assert.equal(winter.gm.worldGuidance, ember.layers![0]!.gm!.worldGuidance);
  assert.deepEqual(winter.catalogs, ember.catalogs, "the ruleset's own entries are never rewritten");
  assert.deepEqual(ember.resolution.difficultyLadder[0], { label: "Easy", dc: 6 }, "and neither is the base ladder");

  // The picker is what hides an entry, per game, out of the catalog the ruleset shipped.
  const entries = ember.catalogs![0]!.entries!;
  const hidden = (id: string, options: Record<string, boolean>) =>
    catalogEntryHiddenByLayers(
      ember,
      options,
      "knacks",
      entries.find((entry) => entry.id === id)!,
    );
  assert.equal(hidden("last-ember", on("hard_winter")), true, "1 Grit is more than a hard winter can spare");
  assert.equal(hidden("hold-the-line", on("hard_winter")), false, "a free knack stays");
  assert.equal(hidden("last-ember", {}), false, "and with the layer off nothing is hidden at all");
  assert.equal(
    catalogEntryHiddenByLayers(ember, on("hard_winter"), "spells", entries[3]!),
    false,
    "a rule only touches the catalog it names",
  );

  // Gravewatch: the same mechanism swaps a ladder of successes.
  const night = applyRulesetLayers(gravewatch, on("long_night"));
  assert.deepEqual(night.resolution.difficultyLadder, [
    { label: "Plain work", successes: 1, target: 7 },
    { label: "Awkward", successes: 2, target: 8 },
    { label: "Grim", successes: 4, target: 9 },
    { label: "Hopeless", successes: 6, target: 9 },
  ]);
  assert.equal(night.resolution.kind, "dice-pool");
  assert.ok(night.gm.checkGuidance.startsWith(gravewatch.gm.checkGuidance), "the ruleset's own text comes first");

  // 5e: values are removed, their labels go with them, and everything else is untouched.
  const low = applyRulesetLayers(fiveE, on("low_magic"));
  const field = low.sheet.fields.find((entry) => entry.id === "spellcasting_ability")!;
  assert.ok(field.type === "enum");
  assert.deepEqual(field.values, ["none", "wis"]);
  assert.deepEqual(field.valueLabels, { none: "None", wis: "Wisdom" });
  assert.equal(field.default, "none");
  const baseField = fiveE.sheet.fields.find((entry) => entry.id === "spellcasting_ability")!;
  assert.ok(baseField.type === "enum" && baseField.values.length === 4, "the ruleset itself is unchanged");
  assert.deepEqual(low.sheet.lists, fiveE.sheet.lists);
  assert.deepEqual(low.battle, fiveE.battle);

  // Conflicts: the LATER layer in declaration order goes, whichever way the options were written.
  const both = { ...on("high_magic", "low_magic"), campaign: "winterhold" };
  assert.deepEqual(
    activeRulesetLayers(fiveE, both).map((layer) => layer.id),
    ["low_magic"],
  );
  assert.equal(applyRulesetLayers(fiveE, both).gm.checkGuidance, low.gm.checkGuidance);
  assert.deepEqual(rulesetLayerSelectionIssues(fiveE, both), [
    { code: "ruleset_layer_conflict", message: '"Low magic" and "High magic" cannot be turned on together.' },
  ]);
  assert.deepEqual(rulesetLayerSelectionIssues(fiveE, on("wild_magic")), [
    { code: "ruleset_layer_unknown", message: 'This ruleset has no layer "wild_magic".' },
  ]);
  assert.deepEqual(rulesetLayerSelectionIssues(fiveE, on("low_magic")), []);
  assert.deepEqual(rulesetLayerSelectionIssues(fiveE, { difficulty: "brutal", "layer.low_magic": false }), []);
  assert.deepEqual(rulesetLayerSelectionIssues(ember, {}), [], "nothing chosen is nothing to refuse");
}

// ── The effective definition is still a ruleset the Engine can read ──
{
  const combinations = (definition: RulesetDefinition): Record<string, boolean>[] => {
    const ids = (definition.layers ?? []).map((layer) => layer.id);
    return Array.from({ length: 2 ** ids.length }, (_, mask) => on(...ids.filter((_id, index) => (mask >> index) & 1)));
  };
  for (const [what, definition] of [
    ["ember-roads", ember],
    ["gravewatch", gravewatch],
    ["5e-2014", fiveE],
  ] as const) {
    for (const options of combinations(definition)) {
      const applied = applyRulesetLayers(definition, options);
      const parsed = rulesetEffectiveDefinitionSchema.safeParse(applied);
      assert.ok(
        parsed.success,
        `${what} with ${JSON.stringify(options)} must stay readable: ${
          parsed.success
            ? ""
            : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
        }`,
      );
      // Nothing that ships needs the one relaxation the effective schema grants, so every layered
      // example still fits the cap a FILE may declare.
      assert.ok(applied.gm.checkGuidance.length <= 1500);
      assert.ok((applied.gm.worldGuidance ?? "").length <= 1500);
    }
  }
}

// ── A layer whose result would not validate is skipped, and the game keeps the rest ──
{
  // Two layers that are each fine on their own and empty the field between them. The file schema
  // cannot see the pair coming, so the fallback is what stops a game losing its rules to it.
  const withRoads = variant(emberText, (doc) => {
    doc.sheet.fields.push({
      id: "road",
      label: "Home road",
      type: "enum",
      values: ["ash", "rust", "glass"],
      default: "ash",
      section: "about",
    });
    doc.layers = [
      {
        id: "no_lowlands",
        label: "No lowlands",
        fields: [{ id: "road", removeValues: ["ash", "rust"], default: "glass" }],
      },
      { id: "no_glass", label: "No glass", fields: [{ id: "road", removeValues: ["glass"], default: "ash" }] },
    ];
  });
  const roads = parsedOrThrow(withRoads, "each layer is usable on its own");
  const values = (definition: RulesetDefinition) => {
    const field = definition.sheet.fields.find((entry) => entry.id === "road")!;
    return field.type === "enum" ? field.values : [];
  };
  assert.deepEqual(values(applyRulesetLayers(roads, on("no_lowlands"))), ["glass"]);
  assert.deepEqual(values(applyRulesetLayers(roads, on("no_glass"))), ["ash", "rust"]);
  // Together they would leave nothing, so the LATER one is dropped and the earlier one stands.
  const together = applyRulesetLayers(roads, on("no_lowlands", "no_glass"));
  assert.deepEqual(values(together), ["glass"], "the game keeps every layer that works");
  assert.ok(rulesetEffectiveDefinitionSchema.safeParse(together).success);
  // And the resolver SAYS which ones those were, so a skipped layer is never named on the sheet and
  // never hides anything in the picker.
  const told = resolveRulesetLayers(roads, on("no_lowlands", "no_glass"));
  assert.deepEqual(
    told.applied.map((layer) => layer.id),
    ["no_lowlands"],
  );
  assert.deepEqual(told.options, { "layer.no_lowlands": true });
  assert.deepEqual(resolveRulesetLayers(roads, {}), { definition: roads, applied: [], options: {} });
}

// ── The LISTED form of a ruleset (what a client holds) is layered too ──
{
  // The listing leaves a catalog's inline entries out and puts a count in their place. The file
  // schema refuses that shape, and a client that could not layer it would show the base rules
  // while the server plays the layered ones.
  const listed = {
    ...ember,
    catalogs: ember.catalogs!.map(({ entries, ...header }) => ({ ...header, entryCount: entries?.length ?? 0 })),
  } as unknown as RulesetDefinition;
  const onClient = resolveRulesetLayers(listed, on("hard_winter"));
  assert.deepEqual(
    onClient.applied.map((layer) => layer.id),
    ["hard_winter"],
    "the layer is applied to the listed form",
  );
  assert.deepEqual(
    onClient.definition.resolution.difficultyLadder,
    applyRulesetLayers(ember, on("hard_winter")).resolution.difficultyLadder,
    "and the ladder is the one the server plays by",
  );
  assert.deepEqual(
    onClient.definition.catalogs,
    listed.catalogs,
    "the catalog summaries come back exactly as they came",
  );
}

// ── Hiding by a word and by a list of words ──
{
  const tagged = parsedOrThrow(
    variant(emberText, (doc) => {
      doc.layers[0].catalogs = [
        { id: "knacks", hide: { filter: "road", equals: "Rustways" } },
        { id: "knacks", hide: { filter: "callings", notIn: ["Scout", "Ember-tender"] } },
      ];
    }),
    "a layer may hide by several rules at once",
  );
  const entry = (id: string) => tagged.catalogs![0]!.entries!.find((candidate) => candidate.id === id)!;
  const hidden = (id: string) => catalogEntryHiddenByLayers(tagged, on("hard_winter"), "knacks", entry(id));
  assert.equal(hidden("scrap-whisper"), true, "a text filter that equals the rule is hidden");
  assert.equal(hidden("road-sense"), false, "a Scout knack on another road is kept");
  assert.equal(hidden("iron-stomach"), true, "no tag of this entry is in the keep list");
  assert.equal(hidden("hold-the-line"), false, "one matching tag is enough to keep it");
  // An entry that says nothing about the filter is never hidden: the layer said nothing about it.
  assert.equal(catalogEntryHiddenByLayers(tagged, on("hard_winter"), "knacks", { filters: undefined }), false);
}

// ── The server: resolution, the route, the prompt and the install gate ──
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-layers-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const installed = [
  { id: "ruleset-ember-roads", text: emberText },
  { id: "ruleset-5e-2014", text: fiveEText },
].map((fixture) => {
  const bytes = Buffer.from(fixture.text, "utf8");
  const manifest = {
    schemaVersion: 2,
    // 1.25, because both files carry layers.
    capabilityApi: { major: 1, minor: 25 },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: fixture.id,
    name: fixture.id,
    version: "0.1.0",
    description: "A packaged ruleset with layers.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length }],
    permissions: [],
    restartRequired: false,
  };
  const packageDir = join(dataDir, "capability-packages", "versions", manifest.id, manifest.version);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, "ruleset.json"), bytes);
  return {
    id: manifest.id,
    version: manifest.version,
    manifest,
    installedAt: "2026-09-19T00:00:00.000Z",
    status: "active",
    error: null,
    legacy: false,
  };
});
writeFileSync(
  join(dataDir, "capability-packages", "installed.json"),
  JSON.stringify({ schemaVersion: 1, packages: installed }),
);

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { loadRulesetRegistry, resolveGameRuleset } =
  await import("../../packages/server/src/services/game/ruleset-registry.service.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { buildGmFormatReminder, buildSetupPrompt } =
  await import("../../packages/server/src/services/game/gm-prompts.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

try {
  const registry = await loadRulesetRegistry(db);
  const pin = (options: Record<string, unknown>) => ({
    gameRuleset: { id: "5e-2014", version: fiveE.version, packageId: "ruleset-5e-2014", options },
  });

  // ── resolveGameRuleset hands every caller the layered definition ──
  {
    const plain = resolveGameRuleset(pin({}), registry);
    assert.equal(plain.status, "ok");
    assert.ok(plain.status === "ok");
    assert.equal(plain.definition, plain.baseDefinition, "no layer on is the registry's own object");
    assert.deepEqual(plain.layers, []);

    const layered = resolveGameRuleset(pin(on("low_magic")), registry);
    assert.ok(layered.status === "ok");
    assert.deepEqual(layered.layers, [{ id: "low_magic", label: "Low magic" }]);
    assert.equal(layered.baseDefinition.gm.checkGuidance, fiveE.gm.checkGuidance);
    assert.ok(layered.definition.gm.checkGuidance.includes("Low magic is on."));
    assert.ok(layered.definition.gm.worldGuidance?.includes("arcane learning has been lost"));
    const field = layered.definition.sheet.fields.find((entry) => entry.id === "spellcasting_ability")!;
    assert.deepEqual(field.type === "enum" ? field.values : [], ["none", "wis"]);

    // A hand-edited pin naming a layer this file does not have resolves anyway: the game keeps its
    // rules, and the choice it could not honour is simply not applied.
    const stale = resolveGameRuleset(pin({ ...on("wild_magic"), difficulty: "brutal" }), registry);
    assert.ok(stale.status === "ok", "a pin the file outgrew never costs a game its ruleset");
    assert.deepEqual(stale.layers, []);
    assert.equal(stale.definition, stale.baseDefinition);

    // Conflicting choices resolve the same way the wizard would have shown them.
    const conflicting = resolveGameRuleset(pin(on("low_magic", "high_magic")), registry);
    assert.ok(conflicting.status === "ok");
    assert.deepEqual(conflicting.layers, [{ id: "low_magic", label: "Low magic" }]);
  }

  // ── /game/create freezes the choice into the pin, and refuses what it cannot honour ──
  {
    const baseConfig = {
      genre: "Fantasy",
      setting: "A quiet harbor",
      tone: "Hopeful",
      difficulty: "normal",
      rating: "sfw",
      playerGoals: "Find my lost friend",
      gmMode: "standalone",
      partyCharacterIds: [],
    } as unknown as GameSetupConfig;
    // The client sends an id and its layer choices; the server rebuilds everything else from its
    // own registry, so the version here is only what a wizard would have had on screen.
    const create = (ruleset: Record<string, unknown>) =>
      app.inject({
        method: "POST",
        url: "/api/game/create",
        payload: { name: "Layered rules", setupConfig: { ...baseConfig, ruleset: { version: 1, ...ruleset } } },
      });

    const chosen = await create({ id: "5e-2014", options: { ...on("low_magic"), difficulty: "brutal" } });
    assert.equal(chosen.statusCode, 200, chosen.body);
    const meta = JSON.parse(chosen.json().sessionChat.metadata);
    assert.deepEqual(meta.gameRuleset, {
      id: "5e-2014",
      version: fiveE.version,
      packageId: "ruleset-5e-2014",
      // The key the Engine does not own rides along untouched: the pin has always kept them.
      options: { "layer.low_magic": true, difficulty: "brutal" },
    });
    assert.deepEqual(meta.gameSetupConfig.ruleset, meta.gameRuleset, "the setup config carries the same pin");
    // And the game plays by it from the first turn, without the route doing anything else.
    const resolved = resolveGameRuleset(meta, registry);
    assert.ok(resolved.status === "ok");
    assert.deepEqual(resolved.layers, [{ id: "low_magic", label: "Low magic" }]);

    const none = await create({ id: "5e-2014" });
    assert.equal(none.statusCode, 200, none.body);
    assert.deepEqual(JSON.parse(none.json().sessionChat.metadata).gameRuleset.options, {});

    const unknown = await create({ id: "5e-2014", options: on("wild_magic") });
    assert.equal(unknown.statusCode, 400);
    assert.equal(unknown.json().code, "ruleset_layer_unknown");
    assert.match(unknown.json().error, /no layer "wild_magic"/);

    const conflicting = await create({ id: "5e-2014", options: on("low_magic", "high_magic") });
    assert.equal(conflicting.statusCode, 400);
    assert.equal(conflicting.json().code, "ruleset_layer_conflict");

    // The record is a player's choice, not a place to park data.
    const oversized = await create({
      id: "5e-2014",
      options: Object.fromEntries(Array.from({ length: RULESET_REF_MAX_OPTIONS + 1 }, (_, i) => [`k${i}`, true])),
    });
    assert.equal(oversized.statusCode, 400);
  }

  // ── The prompt: the reminder gets the layered guidance and ladder for free ──
  {
    const base = {
      hasSceneModel: false,
      hudWidgets: [],
      turnNumber: 3,
      gameActiveState: "exploration" as const,
      partyNames: ["Bram the Quiet"],
      playerName: "Mira",
    };
    const plain = buildGmFormatReminder({ ...base, ruleset: ember });
    assert.match(plain, /Difficulty: Easy 6, Risky 8, Hard 10, Desperate 12\./);
    assert.doesNotMatch(plain, /Hard winter is on\./);

    const layered = resolveGameRuleset(
      {
        gameRuleset: {
          id: "ember-roads",
          version: ember.version,
          packageId: "ruleset-ember-roads",
          options: on("hard_winter"),
        },
      },
      registry,
    );
    assert.ok(layered.status === "ok");
    const winter = buildGmFormatReminder({ ...base, ruleset: layered.definition });
    assert.match(winter, /Difficulty: Easy 7, Risky 9, Hard 11, Desperate 13\./);
    assert.ok(winter.includes(ember.gm.checkGuidance), "the ruleset's own guidance is still there");
    assert.match(winter, /Hard winter is on\./, "with the layer's appended after it");
    // One line, still: the reminder renders `checkGuidance` inside a single bullet.
    assert.ok(
      winter.split("\n").some((line) => line.includes("Hard winter is on.") && line.includes("[skill_check:")),
      "appended guidance never breaks the tag's own line",
    );

    // World generation is the one place a ruleset shapes the setting rather than the turn.
    const setup = buildSetupPrompt({ rulesetWorldGuidance: layered.definition.gm.worldGuidance });
    assert.match(setup, /<ruleset_world>/);
    assert.ok(setup.includes(ember.layers![0]!.gm!.worldGuidance!));
    assert.doesNotMatch(
      buildSetupPrompt({}),
      /<ruleset_world>/,
      "a game with no ruleset writes the prompt it always did",
    );
    assert.doesNotMatch(
      buildSetupPrompt({ rulesetWorldGuidance: null }),
      /<ruleset_world>/,
      "and so does one whose ruleset says nothing about the world",
    );
  }

  // ── Capability API 1.25 ──
  {
    assert.ok(
      supportedCapabilityApi.major > 1 || supportedCapabilityApi.minor >= 25,
      "the host still advertises the layer seam introduced in API 1.25",
    );
    const manifest = (minor: number) => ({ ...installed[0]!.manifest, capabilityApi: { major: 1, minor } });
    /** The example without the keys that gate on a LATER declaration, so these cases are answered
     *  by the layer gate rather than by the one that came after it. */
    const layerFixture = () => {
      const doc = JSON.parse(emberText);
      delete doc.combat;
      // The bestiary is written in the numbers that block declares, and gates on its own later
      // declaration, so it goes with it.
      doc.catalogs = (doc.catalogs ?? []).filter((catalog: Record<string, any>) => catalog.holds !== "creatures");
      for (const catalog of doc.catalogs ?? []) {
        catalog.entries = (catalog.entries ?? []).filter(
          (entry: Record<string, any>) => entry.mechanics?.kind !== "rider",
        );
      }
      for (const entry of doc.catalogs?.[0]?.entries ?? []) {
        // Every key that gates on a LATER declaration than the one this case is about.
        for (const key of [
          "targetCount",
          "autoHit",
          "applies",
          "temporary",
          "budget",
          "plus",
          "free",
          "gives",
          "standard",
          "rider",
        ]) {
          delete entry.mechanics?.[key];
        }
      }
      return doc;
    };
    const withLayers = layerFixture();
    assert.match(
      getCapabilityPackageInstallIssue(manifest(24) as any, withLayers) ?? "",
      /A ruleset with layers requires schemaVersion 2 and capabilityApi 1\.25 or newer/,
      "layers live inside the ruleset file, so the gate reads it",
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(25) as any, withLayers), null);

    // The base world-generation slot is a new key in the same strict file, gated the same way.
    const worldOnly = layerFixture();
    delete worldOnly.layers;
    worldOnly.gm.worldGuidance = "Build a world of long roads and short springs.";
    assert.match(
      getCapabilityPackageInstallIssue(manifest(24) as any, worldOnly) ?? "",
      /A ruleset with gm\.worldGuidance requires schemaVersion 2 and capabilityApi 1\.25 or newer/,
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(25) as any, worldOnly), null);

    // A ruleset with neither installs on the declaration it always needed.
    const neither = layerFixture();
    delete neither.layers;
    delete neither.battle;
    delete neither.catalogs;
    assert.equal(getCapabilityPackageInstallIssue(manifest(20) as any, neither), null);
    // An empty array is not a layer, so it gates nothing either.
    assert.equal(getCapabilityPackageInstallIssue(manifest(20) as any, { ...neither, layers: [] }), null);
  }
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}

console.info("game ruleset layers regressions passed.");
