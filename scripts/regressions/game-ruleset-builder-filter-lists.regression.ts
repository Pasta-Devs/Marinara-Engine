/**
 * A guided-builder step's filter that lists values (Capability API 1.731): a bard's Magical Secrets.
 *
 *   - A catalog step's `filters` may give a filter a list: an entry matching any value is offered.
 *   - Each value takes the filter's own type; import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  rulesetBuilderOptions,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-builder-filter-lists-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 731);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (filters: Record<string, unknown> = { kind: ["spell", "cantrip"] }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({
      id: "magic",
      label: "Magic",
      filters: [
        { id: "kind", label: "Kind", type: "text" },
        { id: "level", label: "Level", type: "number" },
      ],
      feeds: ["spells"],
      entries: [
        ["fireball", "Fireball", "spell", 3],
        ["light", "Light", "cantrip", 0],
        ["spirit-slot", "Spirit Slot", "special", 0],
      ].map(([id, label, kind, level]) => ({
        id,
        label,
        filters: { kind, level },
        rows: [{ list: "spells", values: { name: label, level } }],
      })),
    });
    doc.sheet.builder = {
      steps: [{ id: "secrets", label: "Magical Secrets", kind: "catalog", catalog: "magic", min: 0, max: 2, filters }],
    };
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const offered = (definition: RulesetDefinition) => {
    const step = definition.sheet.builder!.steps[0]!;
    assert.equal(step.kind, "catalog");
    const catalogs = Object.fromEntries((definition.catalogs ?? []).map((one) => [one.id, one.entries ?? []]));
    return rulesetBuilderOptions(definition, step as never, {}, catalogs as never).map((entry) => entry.id);
  };

  // ── A spell or a cantrip, never the special entries ──
  assert.deepEqual(offered(parsed(fiveE())), ["fireball", "light"]);
  // A single value, as before; numbers too.
  assert.deepEqual(offered(parsed(fiveE({ kind: "spell" }))), ["fireball"]);
  assert.deepEqual(offered(parsed(fiveE({ level: [0, 3], kind: ["cantrip"] }))), ["light"]);

  // ── Refusals ──
  refused(fiveE({ kind: [] }), /Too small: expected array to have >=1 items/);
  refused(fiveE({ level: [0, "three"] }), /Filter "level" takes a number/);
  refused(fiveE({ kind: ["spell", 3] }), /Filter "kind" takes a word/);

  // ── The install gate ──
  const gate =
    "A ruleset with a guided-builder step's filter that lists values (steps[].filters) requires schemaVersion 2 and capabilityApi 1.731 or newer";
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    id: "fivee",
    name: "5e",
    version: "1.0.0",
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.equal(getCapabilityPackageInstallIssue(manifest(730) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(731) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(730) as never, fiveE({ kind: "spell" })), gate);

  console.log("Magical Secrets: a builder step's filter lists values, an entry matching any offered; gated at 1.731.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
