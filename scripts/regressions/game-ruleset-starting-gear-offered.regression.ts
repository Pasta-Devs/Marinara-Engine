/**
 * A starting gear choice's option offered only to some sheets (Capability API 1.661): 5e's cleric's
 * "(a) a mace or (b) a warhammer (if proficient)".
 *
 *   - An option whose `offeredWhen` reads zero is refused for that sheet; above zero it is taken.
 *   - A choice none of whose options is offered asks nothing.
 *   - With no sheet to read, every option is offered.
 *   - The option's `offeredWhen` is checked as any sheet read is; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  resolveRulesetStartingGear,
  rulesetItemBook,
  rulesetStartingGearOptionOffered,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-starting-gear-offered-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const emberText = readFileSync(
    fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  const withGear = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(emberText) as Record<string, any>;
    doc.items.startingGear = [
      {
        id: "kit",
        label: "Kit",
        choices: [
          {
            label: "A weapon",
            options: [
              { label: "A spear", lines: [{ item: "outfitter/boar-spear" }], offeredWhen: { field: "toughness" } },
              { label: "An axe", lines: [{ item: "outfitter/hand-axe" }] },
            ],
          },
          {
            label: "Tough only",
            options: [
              { label: "A bow", lines: [{ item: "outfitter/hunting-bow" }], offeredWhen: { field: "toughness" } },
              { label: "A coat", lines: [{ item: "outfitter/leather-coat" }], offeredWhen: { field: "toughness" } },
            ],
          },
        ],
      },
    ];
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const ember = parse(withGear());
  const entries: Record<string, RulesetCatalogEntry[]> = Object.fromEntries(
    (ember.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds === "items" ? [[catalog.id, catalog.entries]] : [],
    ),
  );
  const book = rulesetItemBook(ember, entries);
  const sheet = (toughness: number) => {
    const build = defaultRulesetSheetBuild(ember);
    build.fields.toughness = toughness;
    return build;
  };
  const take = (choices: number[], toughness?: number) =>
    resolveRulesetStartingGear(
      ember,
      book,
      { gear: "kit", choices, picks: {} },
      null,
      undefined,
      toughness === undefined ? undefined : { build: sheet(toughness) },
    );
  const items = (result: ReturnType<typeof take>) => (result.ok ? result.adds.map((add) => add.item).sort() : result);

  // ── Offered to a tough sheet, refused to one with none ──
  assert.deepEqual(items(take([0, 0], 2)), ["outfitter/boar-spear", "outfitter/hunting-bow"]);
  const refused = take([0, -1], 0);
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.match(refused.detail, /"A spear" is not offered to this sheet/);
  // The second choice offers nothing to this sheet, so it asks nothing.
  assert.deepEqual(items(take([1, -1], 0)), ["outfitter/hand-axe"]);
  // No sheet: every option, so every choice is asked.
  assert.equal(take([1, -1]).ok, false);
  assert.deepEqual(items(take([1, 1])), ["outfitter/hand-axe", "outfitter/leather-coat"]);
  const option = ember.items!.startingGear![0]!.choices[0]!.options[0]!;
  assert.equal(rulesetStartingGearOptionOffered(ember, option, sheet(0)), false);
  assert.equal(rulesetStartingGearOptionOffered(ember, option, sheet(1)), true);
  assert.equal(rulesetStartingGearOptionOffered(ember, option, undefined), true);

  // ── Checked as a sheet read; the install gate ──
  const bad = parseRulesetDefinition(
    withGear((doc) => (doc.items.startingGear[0].choices[0].options[0].offeredWhen = { field: "nope" })),
  );
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.issues.join("; "), /choices\.0\.options\.0\.offeredWhen/);
  const gate =
    "A ruleset with starting gear options offered only to some sheets (offeredWhen on a gear choice's option) requires schemaVersion 2 and capabilityApi 1.661 or newer";
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    id: "ember",
    name: "Ember",
    version: "1.0.0",
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.equal(getCapabilityPackageInstallIssue(manifest(660) as never, withGear()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(661) as never, withGear()), gate);

  console.log("Starting gear: a choice's option offered only while its sheet read is above zero; gated at 1.661.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
