/**
 * An Experience's ruleset overlays (Capability API 1.355).
 *
 *   - A map pack names, per ruleset id, a `.overlay.json` file: bestiary creatures, combat conditions, the
 *     sheet conditions they hold, creature tags and entries for the ruleset's other catalogs.
 *   - A game of that Experience plays its ruleset with the overlay merged in: its conditions in the
 *     rules, its creatures and items in the catalogs. A game without the Experience, or of another
 *     ruleset, plays it as it was. An overlay that does not fit is left out whole.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  applyExperienceRulesetOverlay,
  applySheetCommandTags,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  readRulesetLive,
  capabilityPackageManifestSchema,
  experienceOverlayEntries,
  parseRulesetDefinition,
  readExperienceRulesetOverlay,
  type ExperienceRulesetOverlay,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";
import {
  buildRulesetRegistry,
  resolveGameRuleset,
  type RegisteredRuleset,
  type RulesetRegistry,
} from "../../packages/server/src/services/game/ruleset-registry.service.js";
import {
  loadRulesetCatalogEntries,
  openRulesetCatalog,
} from "../../packages/server/src/services/game/ruleset-catalog.service.js";

const text = readFileSync(
  fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
  "utf8",
);
const parsed = parseRulesetDefinition(JSON.parse(text));
assert.ok(parsed.ok);
const base: RulesetDefinition = parsed.definition;
const lurker = base.catalogs!.find((catalog) => catalog.id === "creatures")!.entries![0]!;

const overlayInput = {
  overlayVersion: 1,
  conditions: [{ condition: "owed_frost_held", effects: ["own-attacks-disadvantage"] }],
  sheetConditions: [{ id: "owed_frost_held", label: "Held by the Frost" }],
  creatures: [{ ...lurker, id: "straw-man", label: "Straw Man", summary: "An effigy that walks in the dark." }],
};
const read = readExperienceRulesetOverlay(JSON.stringify(overlayInput));
assert.ok(read.ok, JSON.stringify(read));
const overlay: ExperienceRulesetOverlay = read.overlay;

// ── Its shape ──
assert.ok(!readExperienceRulesetOverlay("{").ok);
assert.ok(!readExperienceRulesetOverlay(JSON.stringify({ ...overlayInput, overlayVersion: 2 })).ok);
assert.ok(!readExperienceRulesetOverlay(JSON.stringify({ ...overlayInput, spells: [] })).ok, "strict");

// ── Merged ──
const merged = applyExperienceRulesetOverlay(base, overlay, false);
assert.ok(merged.ok, JSON.stringify(merged));
assert.ok(merged.definition.combat!.conditions!.some((each) => each.condition === "owed_frost_held"));
assert.ok(merged.definition.sheet.live.conditions.some((each) => each.id === "owed_frost_held"));
assert.deepEqual(
  experienceOverlayEntries(merged.definition, "creatures").map((entry) => entry.id),
  ["straw-man"],
);
assert.deepEqual(experienceOverlayEntries(base, "creatures"), [], "the ruleset itself is untouched");
assert.equal(
  base.sheet.live.conditions.some((each) => each.id === "owed_frost_held"),
  false,
);

// An imported ruleset is played under its namespaced id (`local/<id>`): merged all the same, and kept
// under that id.
const imported = applyExperienceRulesetOverlay({ ...base, id: `local/${base.id}` }, overlay, false);
assert.ok(imported.ok, JSON.stringify(imported));
assert.equal(imported.definition.id, `local/${base.id}`);
assert.deepEqual(
  experienceOverlayEntries(imported.definition, "creatures").map((entry) => entry.id),
  ["straw-man"],
);

// ── What does not fit is left out whole ──
const refused = (patch: Record<string, unknown>, issue: RegExp) => {
  const result = applyExperienceRulesetOverlay(base, { ...overlay, ...patch } as ExperienceRulesetOverlay, false);
  assert.ok(!result.ok && result.issues.some((each) => issue.test(each)), JSON.stringify(result));
};
refused({ sheetConditions: [{ id: "blinded", label: "Blinded" }] }, /"blinded" is the ruleset's already/);
refused(
  { tracks: [{ id: "exhaustion", label: "Exhaustion", min: 0, max: 6 }] },
  /"exhaustion" is the ruleset's already/,
);
refused({ tracks: [{ id: "owing", label: "Owing" }] }, /./);

// ── Sheet tracks (1.367): a mark of Owing, declared by the overlay and played as the ruleset's own ──
{
  const owingOverlay = readExperienceRulesetOverlay(
    JSON.stringify({ ...overlayInput, tracks: [{ id: "owing", label: "Owing", min: 0, max: 20, default: 0 }] }),
  );
  assert.ok(owingOverlay.ok, JSON.stringify(owingOverlay));
  const owed = applyExperienceRulesetOverlay(base, owingOverlay.overlay, false);
  assert.ok(owed.ok, JSON.stringify(owed));
  const definition = owed.definition;
  assert.ok(definition.sheet.live.tracks.some((track) => track.id === "owing"));
  assert.ok(!base.sheet.live.tracks.some((track) => track.id === "owing"), "the ruleset itself is untouched");
  // On the sheet, moved by a sheet command and stopped where it says.
  const build = defaultRulesetSheetBuild(definition);
  assert.equal(readRulesetLive(definition, build, {}).tracks.find((track) => track.id === "owing")?.value, 0);
  const marked = applySheetCommandTags('[sheet: who="Jory" op="track" track="owing" by="2" upto="20"]', {
    definition,
    cards: [{ name: "Jory", build }],
    playerName: "Jory",
    live: {},
  });
  assert.deepEqual(marked.live.jory?.tracks, { owing: 2 });
  // Held Ground's marks are kept for it, where a ruleset without it drops them.
  const ground = { label: "The Held Autumn", marks: [{ track: "owing", by: 1 }] };
  const fight = (of: RulesetDefinition) =>
    createRulesetEncounter({
      definition: of,
      seed: 1,
      combatants: [{ id: "jory", name: "Jory", side: "party", build: defaultRulesetSheetBuild(of), live: {} }],
      heldGround: ground,
    }).heldGround;
  assert.deepEqual(fight(definition), ground);
  assert.deepEqual(fight(base), { label: "The Held Autumn" });
}
refused({ creatures: [lurker] }, /"thorn-lurker" is taken already/);
refused({ catalogs: { spells_of_the_wheel: [] } }, /not a catalog of this ruleset/);
refused({ creatureTags: [{ id: "unreaped", label: "Unreaped" }] }, /creatureTags: the ruleset has none/);
refused({ conditions: [{ condition: "owed_frost_held", effects: ["no-such-effect"] }] }, /./);

// ── A catalog kept in a file ──
// Its entries are only known once the file is read, so the server passes their ids in: an overlay
// entry may not take one, and a story cost must name one.
const { entries: _ownEntries, ...creaturesHeader } = base.catalogs!.find((each) => each.id === "creatures")!;
const fileBacked = {
  ...base,
  catalogs: base.catalogs!.map((each) =>
    each.id === "creatures" ? { ...creaturesHeader, asset: "catalogs/creatures.json" } : each,
  ),
} as RulesetDefinition;
const fileIds = new Map([["creatures", new Set(["thorn-lurker", "barrow-cat"])]]);
const onFile = (patch: Record<string, unknown>) =>
  applyExperienceRulesetOverlay(fileBacked, { ...overlay, ...patch } as ExperienceRulesetOverlay, false, fileIds);
assert.ok(onFile({}).ok, JSON.stringify(onFile({})));
const takenOnFile = onFile({ creatures: [{ ...lurker, id: "barrow-cat" }] });
assert.ok(
  !takenOnFile.ok && /"barrow-cat" is taken already/.test(takenOnFile.issues.join()),
  JSON.stringify(takenOnFile),
);
assert.ok(onFile({ storyUses: [{ item: "creatures/barrow-cat", flag: "debts", add: -1 }] }).ok, "one of the file's");
assert.ok(onFile({ storyUses: [{ item: "creatures/straw-man", flag: "debts", add: -1 }] }).ok, "one it adds");
const noSuchOnFile = onFile({ storyUses: [{ item: "creatures/no-such-cat", flag: "debts", add: -1 }] });
assert.ok(
  !noSuchOnFile.ok && /"creatures\/no-such-cat" is no entry of its catalog/.test(noSuchOnFile.issues.join()),
  JSON.stringify(noSuchOnFile),
);
const noSuchInline = applyExperienceRulesetOverlay(
  base,
  { ...overlay, storyUses: [{ item: "creatures/no-such-cat", flag: "debts", add: -1 }] },
  false,
);
assert.ok(!noSuchInline.ok, "an inline catalog is looked in as well");

// ── A game of the Experience plays it merged ──
const registry: RulesetRegistry = Object.assign(
  buildRulesetRegistry([{ packageId: "ruleset-5e", data: text }], () => {}),
  { overlays: new Map([["held-autumn\n5e-2014", { overlay, sha256: "a".repeat(64) }]]) },
);
const pin = { id: "5e-2014", version: base.version, packageId: "ruleset-5e", options: {} };
const game = resolveGameRuleset({ gameRuleset: pin, gameMapPack: { packageId: "held-autumn" } }, registry);
assert.equal(game.status, "ok");
if (game.status !== "ok") throw new Error();
assert.ok(game.definition.sheet.live.conditions.some((each) => each.id === "owed_frost_held"));
const catalog = game.definition.catalogs!.find((each) => each.id === "creatures")!;
const entries = await loadRulesetCatalogEntries(game.packageId, game.definition, catalog);
assert.ok(entries.ok);
assert.ok(
  entries.entries.some((entry) => entry.id === "straw-man"),
  "its creatures are in the bestiary",
);
assert.ok(
  entries.entries.some((entry) => entry.id === "thorn-lurker"),
  "beside the ruleset's own",
);
// The picker's route reads the ruleset's own catalog: what an Experience adds is the game's, read
// on its turns, and the picker opens the ruleset as installed.
const opened = await openRulesetCatalog(game.packageId, game.definition, catalog);
assert.ok(opened.kind === "inline" && !opened.entries.some((entry) => entry.id === "straw-man"), "the ruleset's own");
// The same pin again is merged once.
const again = resolveGameRuleset({ gameRuleset: pin, gameMapPack: { packageId: "held-autumn" } }, registry);
assert.equal(again.status === "ok" && again.definition, game.definition);
// Another Experience, or none: as it was.
for (const meta of [{ gameRuleset: pin }, { gameRuleset: pin, gameMapPack: { packageId: "other" } }]) {
  const plain = resolveGameRuleset(meta, registry);
  assert.ok(
    plain.status === "ok" && !plain.definition.sheet.live.conditions.some((each) => each.id === "owed_frost_held"),
  );
}

// An overlay checked against catalog files merges again when they change.
const withFiles: RulesetRegistry = Object.assign(
  buildRulesetRegistry(
    [{ packageId: "ruleset-5e", data: JSON.stringify({ ...JSON.parse(text), ...fileBacked }) }],
    () => {},
  ),
  {
    overlays: registry.overlays,
    overlayFileIds: new Map([[`held-autumn\n5e-2014\n${base.version}`, { ids: fileIds, key: "creatures:1" }]]),
  },
);
const filed = resolveGameRuleset({ gameRuleset: pin, gameMapPack: { packageId: "held-autumn" } }, withFiles);
assert.ok(filed.status === "ok" && filed.definition !== game.definition, "merged against the file's ids");
// Two Experiences overlay the same ruleset: each is judged against the ids of the catalogs it names,
// kept by its own package, so the second's clash is not hidden behind the first's answer.
const second = { ...overlay, creatures: [{ ...lurker, id: "barrow-cat" }] } as ExperienceRulesetOverlay;
const clash: RulesetRegistry = Object.assign(new Map(withFiles), {
  overlays: new Map([...registry.overlays!, ["far-shore\n5e-2014", { overlay: second, sha256: "b".repeat(64) }]]),
  overlayFileIds: new Map([
    [`held-autumn\n5e-2014\n${base.version}`, { ids: fileIds, key: "creatures:1" }],
    [`far-shore\n5e-2014\n${base.version}`, { ids: fileIds, key: "creatures:1" }],
  ]),
});
const heldOverlay = (packageId: string) => {
  const each = resolveGameRuleset({ gameRuleset: pin, gameMapPack: { packageId } }, clash);
  return each.status === "ok" && each.definition.sheet.live.conditions.some((one) => one.id === "owed_frost_held");
};
assert.ok(heldOverlay("held-autumn"), "the first fits");
assert.ok(!heldOverlay("far-shore"), "the second takes a file's entry and is left out whole");
// One ruleset imported (`local/<id>`) or from a repository (`<owner>/<id>`) plays the overlay for its bare
// id, and one for its exact id wins over that.
const community = (id: string): RegisteredRuleset => {
  const definition = { ...base, id };
  return { definition, packageId: null, versions: new Map([[base.version, definition]]) };
};
const exactOverlay: ExperienceRulesetOverlay = {
  ...overlay,
  sheetConditions: [{ id: "owed_frost_exact", label: "Held by the Frost (exact)" }],
  conditions: [{ condition: "owed_frost_exact", effects: ["own-attacks-disadvantage"] }],
};
const namespaced: RulesetRegistry = Object.assign(
  new Map([
    ["local/5e-2014", community("local/5e-2014")],
    ["alice/5e-2014", community("alice/5e-2014")],
    ["bob/5e-2014", community("bob/5e-2014")],
  ]),
  {
    overlays: new Map([
      ["held-autumn\n5e-2014", { overlay, sha256: "b".repeat(64) }],
      ["held-autumn\nbob/5e-2014", { overlay: exactOverlay, sha256: "c".repeat(64) }],
    ]),
  },
);
const playedAs = (id: string) => {
  const played = resolveGameRuleset(
    {
      gameRuleset: { id, version: base.version, packageId: null, options: {} },
      gameMapPack: { packageId: "held-autumn" },
    },
    namespaced,
  );
  assert.equal(played.status, "ok", JSON.stringify(played));
  return played.status === "ok" ? played.definition : base;
};
for (const id of ["local/5e-2014", "alice/5e-2014"]) {
  const played = playedAs(id);
  assert.equal(played.id, id);
  assert.ok(
    played.sheet.live.conditions.some((each) => each.id === "owed_frost_held"),
    `${id} plays the bare overlay`,
  );
}
const bob = playedAs("bob/5e-2014");
assert.ok(
  bob.sheet.live.conditions.some((each) => each.id === "owed_frost_exact"),
  "the exact overlay wins",
);
assert.ok(!bob.sheet.live.conditions.some((each) => each.id === "owed_frost_held"));

// ── The manifest names them ──
const manifest = (rulesets: unknown, minor = 355) =>
  capabilityPackageManifestSchema.safeParse({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "held-autumn",
    name: "The Held Autumn",
    version: "1.0.0",
    description: "An Experience.",
    engine: { min: "2.3.0", maxExclusive: "99.0.0" },
    kind: ["agent"],
    entrypoints: { client: "client.js" },
    contributions: {
      slots: ["game-surface"],
      gameSurface: { setup: {}, mapPack: { kit: "map/v.worldkit.json", rulesets } },
      assets: { paths: ["map/v.worldkit.json", "rules/5e.overlay.json"] },
    },
    files: [
      { path: "client.js", sha256: "0".repeat(64), bytes: 1 },
      { path: "map/v.worldkit.json", sha256: "0".repeat(64), bytes: 1 },
      { path: "rules/5e.overlay.json", sha256: "0".repeat(64), bytes: 1 },
    ],
    permissions: ["ui"],
    restartRequired: false,
  });
const ok = manifest([{ ruleset: "5e-2014", overlay: "rules/5e.overlay.json" }]);
assert.ok(ok.success, JSON.stringify(!ok.success && ok.error.issues));
assert.ok(!manifest([{ ruleset: "5e-2014", overlay: "rules/5e.overlay.json" }], 354).success, "needs 1.355");
assert.ok(
  !manifest([
    { ruleset: "5e-2014", overlay: "rules/5e.overlay.json" },
    { ruleset: "5e-2014", overlay: "rules/5e.overlay.json" },
  ]).success,
  "one overlay a ruleset",
);
assert.ok(!manifest([{ ruleset: "5e-2014", overlay: "rules/5e.json" }]).success, "a .overlay.json file");

console.log("Experience ruleset overlays: merged into its games' rulesets, whole or not at all.");
