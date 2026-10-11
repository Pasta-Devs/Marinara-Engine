/**
 * An Experience's ruleset overlays (Capability API 1.363).
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
  type RulesetRegistry,
} from "../../packages/server/src/services/game/ruleset-registry.service.js";
import { loadRulesetCatalogEntries } from "../../packages/server/src/services/game/ruleset-catalog.service.js";

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

// ── What does not fit is left out whole ──
const refused = (patch: Record<string, unknown>, issue: RegExp) => {
  const result = applyExperienceRulesetOverlay(base, { ...overlay, ...patch } as ExperienceRulesetOverlay, false);
  assert.ok(!result.ok && result.issues.some((each) => issue.test(each)), JSON.stringify(result));
};
refused({ sheetConditions: [{ id: "blinded", label: "Blinded" }] }, /"blinded" is the ruleset's already/);
refused({ creatures: [lurker] }, /"thorn-lurker" is taken already/);
refused({ catalogs: { spells_of_the_wheel: [] } }, /not a catalog of this ruleset/);
refused({ creatureTags: [{ id: "unreaped", label: "Unreaped" }] }, /creatureTags: the ruleset has none/);
refused({ conditions: [{ condition: "owed_frost_held", effects: ["no-such-effect"] }] }, /./);

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

// ── The manifest names them ──
const manifest = (rulesets: unknown, minor = 363) =>
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
assert.ok(!manifest([{ ruleset: "5e-2014", overlay: "rules/5e.overlay.json" }], 362).success, "needs 1.363");
assert.ok(
  !manifest([
    { ruleset: "5e-2014", overlay: "rules/5e.overlay.json" },
    { ruleset: "5e-2014", overlay: "rules/5e.overlay.json" },
  ]).success,
  "one overlay a ruleset",
);
assert.ok(!manifest([{ ruleset: "5e-2014", overlay: "rules/5e.json" }]).success, "a .overlay.json file");

console.log("Experience ruleset overlays: merged into its games' rulesets, whole or not at all.");
