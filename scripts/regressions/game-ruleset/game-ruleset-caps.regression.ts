/**
 * Ruleset ceilings (Capability API 1.340): a ruleset may be up to 512 KB and a catalog file up to 2 MB. A
 * package over the earlier 256 KB and 1 MB declares 1.340, an editor's check says so, and a package file
 * that large imports.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  RULESET_CATALOG_EARLIER_MAX_BYTES,
  RULESET_CATALOG_MAX_BYTES,
  RULESET_EARLIER_MAX_BYTES,
  RULESET_MAX_BYTES,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-caps-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";

const example = JSON.parse(
  readFileSync(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"),
) as Record<string, any>;
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/** The ember-roads example as a package file, its first catalog in its own file (padded to `catalogBytes`). */
function packageFile(catalogBytes = 0, minor = 74) {
  const ruleset = structuredClone(example);
  ruleset.id = "ember-roads-caps";
  const [first] = ruleset.catalogs as Array<Record<string, any>>;
  const plain = JSON.stringify({ schemaVersion: 1, catalog: first.id, entries: first.entries });
  // Padded with whitespace, which the reader drops when it keeps the document as read.
  const catalog = Buffer.from(`{${" ".repeat(Math.max(0, catalogBytes - plain.length))}${plain.slice(1)}`);
  delete first.entries;
  first.asset = `catalogs/${first.id}.json`;
  const files = [
    { name: "ruleset.json", data: Buffer.from(JSON.stringify(ruleset)) },
    { name: first.asset as string, data: catalog },
  ];
  return {
    format: "marinara-ruleset",
    version: 1,
    manifest: {
      schemaVersion: 2,
      id: "ember-roads-caps",
      name: "Ember Roads (caps)",
      version: "1.0.0",
      description: "",
      engine: { min: "2.4.0", maxExclusive: "3.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: files.map((file) => file.name) } },
      files: files.map((file) => ({ path: file.name, sha256: sha256(file.data), bytes: file.data.length })),
      permissions: [],
      restartRequired: false,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    },
    files: Object.fromEntries(files.map((file) => [file.name, file.data.toString("base64")])),
  };
}
const firstCatalog = (example.catalogs as Array<{ id: string; entries: Array<Record<string, any>> }>)[0]!;

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { setCustomAgentImportsEnabled } =
  await import("../../../packages/server/src/services/agents/custom-agent-import-policy.service.js");
const { gameRulesetsRoutes } = await import("../../../packages/server/src/routes/game-rulesets.routes.js");
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { loadRulesetCatalogEntries } =
  await import("../../../packages/server/src/services/game/ruleset-catalog.service.js");
const { readRulesetRegistry } = await import("../../../packages/server/src/services/game/ruleset-registry.service.js");

try {
  // ── The ceilings ──
  assert.equal(RULESET_MAX_BYTES, 512 * 1024);
  assert.equal(RULESET_EARLIER_MAX_BYTES, 256 * 1024);
  assert.equal(RULESET_CATALOG_MAX_BYTES, 2 * 1024 * 1024);
  assert.equal(RULESET_CATALOG_EARLIER_MAX_BYTES, 1024 * 1024);

  // ── The gate: a package over the earlier ceilings declares 1.340 ──
  const gate =
    "A ruleset package whose ruleset.json is over 256 KB or whose catalog file is over 1 MB requires schemaVersion 2 and capabilityApi 1.340 or newer";
  const manifest = (minor: number, rulesetBytes: number, catalogBytes: number) =>
    ({
      ...packageFile().manifest,
      capabilityApi: { major: 1, minor },
      files: [
        { path: "ruleset.json", sha256: "0".repeat(64), bytes: rulesetBytes },
        { path: `catalogs/${firstCatalog.id}.json`, sha256: "0".repeat(64), bytes: catalogBytes },
      ],
    }) as never;
  assert.equal(getCapabilityPackageInstallIssue(manifest(339, RULESET_EARLIER_MAX_BYTES + 1, 10)), gate);
  assert.equal(getCapabilityPackageInstallIssue(manifest(339, 10, RULESET_CATALOG_EARLIER_MAX_BYTES + 1)), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(340, RULESET_MAX_BYTES, RULESET_CATALOG_MAX_BYTES)), gate);
  assert.notEqual(
    getCapabilityPackageInstallIssue(manifest(339, RULESET_EARLIER_MAX_BYTES, RULESET_CATALOG_EARLIER_MAX_BYTES)),
    gate,
    "at the earlier ceilings exactly: no gate",
  );

  const db = await getDB();
  await setCustomAgentImportsEnabled(db, true);
  const app = Fastify();
  app.decorate("db", db);
  await app.register(gameRulesetsRoutes, { prefix: "/api/game-rulesets" });
  try {
    const post = (url: string, payload: unknown) =>
      app.inject({ method: "POST", url: `/api/game-rulesets${url}`, payload: payload as never });

    // ── An editor's check: the least capability API counts the ruleset's size ──
    const small = JSON.stringify(example);
    const smallCheck = await post("/check", { definition: small });
    assert.equal(smallCheck.statusCode, 200, smallCheck.body);
    assert.ok(smallCheck.json().capabilityApi.minor < 340, smallCheck.body);
    const padded = { ...example, $comment: "" };
    padded.$comment = " ".repeat(RULESET_EARLIER_MAX_BYTES + 1000 - Buffer.byteLength(JSON.stringify(padded)));
    const big = JSON.stringify(padded);
    assert.ok(Buffer.byteLength(big) > RULESET_EARLIER_MAX_BYTES && Buffer.byteLength(big) < RULESET_MAX_BYTES);
    const bigCheck = await post("/check", { definition: big });
    assert.equal(bigCheck.json().ok, true, bigCheck.body.slice(0, 300));
    assert.equal(bigCheck.json().capabilityApi.minor, 340);

    // ── A package file with a catalog over the earlier ceiling imports, and a game reads it ──
    const large = packageFile(RULESET_CATALOG_EARLIER_MAX_BYTES + 1000, 340);
    const largeCatalog = Buffer.from(large.files[`catalogs/${firstCatalog.id}.json`]!, "base64");
    assert.ok(
      largeCatalog.length > RULESET_CATALOG_EARLIER_MAX_BYTES && largeCatalog.length < RULESET_CATALOG_MAX_BYTES,
    );
    const added = await post("/import-package", { package: large });
    assert.equal(added.statusCode, 200, added.body.slice(0, 300));
    const registered = (await readRulesetRegistry(db)).get("local/ember-roads-caps");
    assert.ok(registered, "registered");
    const definition = registered.versions?.get(1) ?? registered.definition;
    const header = definition.catalogs!.find((each) => each.id === firstCatalog.id)!;
    const played = await loadRulesetCatalogEntries(null, definition, header);
    assert.ok(played.ok, JSON.stringify(played).slice(0, 300));
    assert.equal(played.entries.length, firstCatalog.entries.length);
  } finally {
    await app.close();
    await closeDB();
  }

  console.log("Ruleset caps: 512 KB rulesets and 2 MB catalog files, gated at 1.340.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
