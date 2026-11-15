/**
 * A pool or track drawn as a bar or dots (Capability API 1.828): `display: "bar"` adds a fill bar to
 * its row on the sheet, `display: "dots"` a row of dots.
 *
 * What is pinned here:
 *   - The schema takes `display` on a live pool, a plain track and a party pool, and nothing but
 *     `counter`, `bar` or `dots`.
 *   - A packaged ruleset that uses it, on the sheet or the party, declares 1.828; one without it
 *     installs as before.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRulesetDefinition } from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-sheet-bars-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const { getCapabilityPackageInstallIssue } =
    await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
  const emberText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(emberText) as Record<string, any>;
    edit?.(document);
    return document;
  };
  const issuesOf = (document: unknown) => {
    const result = parseRulesetDefinition(document);
    return result.ok ? [] : result.issues;
  };

  // The schema.
  const barred = doc((document) => {
    document.sheet.live.pools[0].display = "bar";
    document.sheet.live.tracks[0].display = "dots";
    document.sheet.live.tracks[1].display = "counter";
  });
  const parsed = parseRulesetDefinition(barred);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  assert.equal(parsed.definition.sheet.live.pools[0]!.display, "bar");
  assert.equal(parsed.definition.sheet.live.tracks[0]!.display, "dots");
  assert.equal(parsed.definition.sheet.live.tracks[1]!.display, "counter");
  const party = doc((document) => {
    document.party = { label: "Crew", pools: [{ id: "supply", label: "Supply", max: { const: 6 }, display: "bar" }] };
  });
  assert.deepEqual(issuesOf(party), [], "a party pool takes it");
  assert.notDeepEqual(
    issuesOf(doc((document) => (document.sheet.live.pools[0].display = "gauge"))),
    [],
    "only counter, bar or dots",
  );

  // The package gate.
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-sheet-bars",
    name: "Sheet bars",
    version: "0.1.0",
    description: "A packaged ruleset that draws a pool as a bar.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const tracked = doc((document) => (document.sheet.live.tracks[0].display = "bar"));
  for (const document of [barred, tracked, party]) {
    assert.match(getCapabilityPackageInstallIssue(manifest(827) as any, document) ?? "", /capabilityApi 1\.828/);
    assert.equal(getCapabilityPackageInstallIssue(manifest(828) as any, document), null);
  }
  assert.doesNotMatch(
    getCapabilityPackageInstallIssue(manifest(827) as any, doc()) ?? "",
    /1\.828/,
    "a ruleset without it is not held to 1.828",
  );
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
