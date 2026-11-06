/**
 * A sheet migration's `setColumn` (Capability API 1.794): one column set on every list row whose
 * `where` columns each hold one of the values listed, as attack rows made before a weapon's finesse
 * was set. Text matches ignoring case and spaces at its ends, a number exactly. The one step that
 * overwrites. Import checks: the list and every column named are on the sheet. Installing one needs
 * 1.794.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  migrateRulesetSheetBuild,
  parseRulesetDefinition,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-set-column-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const step = {
    setColumn: {
      list: "attacks",
      where: { name: ["Dagger", "Rapier"], ability: ["str", "dex"] },
      column: "finesse",
      to: true,
    },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.version = 2;
    doc.sheet.migrations = [{ from: 1, steps: [step] }];
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, message: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.ok(
      !result.ok && result.issues.some((issue) => message.test(issue)),
      result.ok ? "accepted" : result.issues.join("; "),
    );
  };
  const definition = parsed(document());
  const build = {
    abilities: {},
    skills: {},
    saves: {},
    bonuses: {},
    fields: {},
    lists: {
      attacks: [
        { name: " dagger ", ability: "str", finesse: false },
        { name: "Rapier", ability: "dex" },
        { name: "Rapier", ability: "spell" },
        { name: "Longsword", ability: "str", finesse: false },
      ],
    },
  } as never;
  const migrated = migrateRulesetSheetBuild(definition, build, 1) as { lists: { attacks: Record<string, unknown>[] } };
  assert.deepEqual(
    migrated.lists.attacks.map((row) => row.finesse),
    [true, true, undefined, false],
    "set on the rows both columns match, ignoring case and spaces at the ends, overwriting what was there",
  );
  assert.equal(
    (build as { lists: { attacks: Record<string, unknown>[] } }).lists.attacks[0]!.finesse,
    false,
    "the stored build is untouched",
  );
  // Already on the new layout: nothing runs.
  assert.equal(migrateRulesetSheetBuild(definition, build, 2), build);

  refused(
    document((doc) => (doc.sheet.migrations[0].steps[0] = { setColumn: { ...step.setColumn, list: "nope" } })),
    /Unknown list "nope"/,
  );
  refused(
    document((doc) => (doc.sheet.migrations[0].steps[0] = { setColumn: { ...step.setColumn, column: "nope" } })),
    /Unknown column "nope"/,
  );
  refused(
    document(
      (doc) => (doc.sheet.migrations[0].steps[0] = { setColumn: { ...step.setColumn, where: { nope: ["x"] } } }),
    ),
    /Unknown column "nope"/,
  );
  refused(
    document((doc) => (doc.sheet.migrations[0].steps[0] = { setColumn: { ...step.setColumn, where: {} } })),
    /1 and 8 columns/,
  );

  // Installing one needs 1.794.
  const issue = (minor: number) =>
    getCapabilityPackageInstallIssue(
      {
        schemaVersion: 2,
        capabilityApi: { major: 1, minor },
        id: "ruleset-test",
        kind: ["ruleset"],
        permissions: [],
        restartRequired: false,
        contributions: { assets: { paths: ["ruleset.json"] } },
      } as never,
      document(),
    );
  assert.match(issue(793) ?? "", /setColumn.*1\.794/);
  assert.doesNotMatch(issue(794) ?? "", /setColumn/);

  console.log(
    "Sheet migrations set a column: on the rows they match, ignoring case, refused for a list or column the sheet lacks, gated at 1.794.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
