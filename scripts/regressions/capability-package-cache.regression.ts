// ──────────────────────────────────────────────
// Regression: capability-package delivery cache validators (#5082)
// ──────────────────────────────────────────────
// Pins the HTTP caching contract for /api/capability-packages/:id/client and
// /:id/assets/*: a strong ETag derived from the manifest-recorded sha256,
// 304 on a matching If-None-Match, a DIFFERENT validator after an update,
// `no-cache` (never immutable) on the client bundle, and immutable asset
// responses only when the request pins the installed version with ?v=.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-capability-cache-"));
process.env.DATA_DIR = dataDir;

const packagesRoot = join(dataDir, "capability-packages");
const registryPath = join(packagesRoot, "installed.json");

const CLIENT_V1 = "// cache regression client v1\nexport {};\n";
const CLIENT_V2 = "// cache regression client v2 — different bytes\nexport {};\n";
// A 1×1 PNG; the asset route only serves manifest-declared image files.
const ICON = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
// contributions.assets fixtures (general asset delivery, #5091): a nested
// tileset image and a tilemap JSON, plus a file that is deliberately NOT
// declared in contributions.assets to prove the allowlist still gates.
// TILES must be DISTINCT bytes from ICON or the ETag assertions cannot tell
// which file the route actually served (review finding). 1×1 grayscale PNG.
const TILES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const TILEMAP = JSON.stringify({ zone: "cache-probe", w: 2, h: 2, tiles: [0, 1, 1, 0] });
const SECRET = "not servable\n";

const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

function writeFixture(version: string, clientSource: string) {
  const versionRoot = join(packagesRoot, "versions", "cache-probe", version);
  mkdirSync(join(versionRoot, "art"), { recursive: true });
  writeFileSync(join(versionRoot, "client.js"), clientSource);
  writeFileSync(join(versionRoot, "icon.png"), ICON);
  writeFileSync(join(versionRoot, "art", "tiles.png"), TILES);
  writeFileSync(join(versionRoot, "art", "zone.json"), TILEMAP);
  writeFileSync(join(versionRoot, "art", "secret.png"), SECRET);
  const manifest = {
    // schemaVersion 2: contributions.assets is gated on capabilityApi ≥ 1.10,
    // which only the v2 manifest variant can declare.
    schemaVersion: 2,
    capabilityApi: { major: 1, minor: 10 },
    builtAgainst: { engineVersion: "2.4.3", engineCommit: "a".repeat(40) },
    id: "cache-probe",
    name: "Cache Probe",
    version,
    description: "Capability package cache-validator regression fixture.",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { client: "client.js" },
    contributions: {
      slots: ["home-browser-tab"],
      homeBrowserTab: { label: "Cache Probe", iconPaths: ["icon.png"] },
      // General asset delivery (#5091): nested image + JSON metadata.
      assets: { paths: ["art/tiles.png", "art/zone.json"] },
    },
    files: [
      { path: "client.js", sha256: sha256(clientSource), bytes: Buffer.byteLength(clientSource) },
      { path: "icon.png", sha256: sha256(ICON), bytes: ICON.byteLength },
      { path: "art/tiles.png", sha256: sha256(TILES), bytes: TILES.byteLength },
      { path: "art/zone.json", sha256: sha256(TILEMAP), bytes: Buffer.byteLength(TILEMAP) },
      // On disk AND hash-pinned, but NOT in contributions.assets/iconPaths —
      // must stay unservable.
      { path: "art/secret.png", sha256: sha256(SECRET), bytes: Buffer.byteLength(SECRET) },
    ],
    permissions: [],
    restartRequired: false,
  };
  writeFileSync(join(versionRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  const record = {
    id: "cache-probe",
    version,
    manifest,
    installedAt: "2026-08-15T00:00:00.000Z",
    status: "active",
    error: null,
    readiness: "ready",
    readinessError: null,
    legacy: false,
  };
  mkdirSync(packagesRoot, { recursive: true });
  writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, packages: [record] }, null, 2));
  return manifest;
}

async function main() {
  const manifestV1 = writeFixture("1.0.0", CLIENT_V1);

  // fastify is a server-workspace dependency; under pnpm's strict layout it is
  // not resolvable from scripts/, so resolve it from the server package.
  const { createRequire } = await import("node:module");
  const serverRequire = createRequire(
    new URL("../../packages/server/src/routes/capability-packages.routes.ts", import.meta.url),
  );
  const fastify = serverRequire("fastify") as typeof import("fastify").default;
  const { capabilityPackagesRoutes } = await import(
    "../../packages/server/src/routes/capability-packages.routes.js"
  );
  const { rateLimitHook, resetRateLimitBucketsForTests } = await import(
    "../../packages/server/src/middleware/rate-limit.js"
  );
  resetRateLimitBucketsForTests();
  const app = fastify({ logger: false });
  app.addHook("onRequest", rateLimitHook);
  await app.register(capabilityPackagesRoutes, { prefix: "/api/capability-packages" });

  const clientEtag = `"${manifestV1.files[0]!.sha256}"`;
  const iconEtag = `"${manifestV1.files[1]!.sha256}"`;

  // ── /client: 200 with a strong manifest-hash ETag, always-revalidate ──
  const first = await app.inject({ method: "GET", url: "/api/capability-packages/cache-probe/client?v=1.0.0" });
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers.etag, clientEtag, "client ETag must be the manifest sha256");
  assert.equal(first.headers["cache-control"], "no-cache, must-revalidate", "client bundle must never be immutable");
  assert.equal(first.headers["x-content-type-options"], "nosniff");
  assert.equal(first.body, CLIENT_V1);
  // Package file serving sits in its own rate-limit bucket, not the generous
  // default one (CodeQL: file-system access without route-scoped limiting).
  assert.equal(
    first.headers["ratelimit-limit"],
    "240",
    "package file routes must match the capability-package-files rate-limit rule",
  );

  // ── /client: matching If-None-Match answers 304 with no body ──
  for (const candidate of [clientEtag, `W/${clientEtag}`, `"other", ${clientEtag}`]) {
    const revalidated = await app.inject({
      method: "GET",
      url: "/api/capability-packages/cache-probe/client?v=1.0.0",
      headers: { "if-none-match": candidate },
    });
    assert.equal(revalidated.statusCode, 304, `304 expected for If-None-Match: ${candidate}`);
    assert.equal(revalidated.body, "");
    assert.equal(revalidated.headers.etag, clientEtag);
    assert.equal(revalidated.headers["x-content-type-options"], "nosniff", "nosniff must survive the 304 early return");
  }

  // ── /client: a non-matching validator still gets the full body ──
  const mismatched = await app.inject({
    method: "GET",
    url: "/api/capability-packages/cache-probe/client",
    headers: { "if-none-match": `"${"0".repeat(64)}"` },
  });
  assert.equal(mismatched.statusCode, 200);
  assert.equal(mismatched.body, CLIENT_V1);

  // ── assets: always-revalidate without ?v=, immutable only when ?v= matches ──
  const assetPlain = await app.inject({ method: "GET", url: "/api/capability-packages/cache-probe/assets/icon.png" });
  assert.equal(assetPlain.statusCode, 200);
  assert.equal(assetPlain.headers["cache-control"], "private, no-cache, must-revalidate");
  assert.equal(assetPlain.headers.etag, iconEtag);
  assert.equal(assetPlain.headers["ratelimit-limit"], "240", "asset serving shares the package-files rate bucket");

  // ?v= is a cache-key convenience only — it must NEVER upgrade the policy to
  // immutable: install policy permits same-version republishing with different
  // bytes, so a version-tagged URL is not content-addressed (review finding).
  for (const query of ["?v=1.0.0", "?v=9.9.9", ""]) {
    const assetAnyQuery = await app.inject({
      method: "GET",
      url: `/api/capability-packages/cache-probe/assets/icon.png${query}`,
    });
    assert.equal(assetAnyQuery.statusCode, 200);
    assert.equal(
      assetAnyQuery.headers["cache-control"],
      "private, no-cache, must-revalidate",
      `asset responses always revalidate (query: "${query}")`,
    );
  }

  const assetRevalidated = await app.inject({
    method: "GET",
    url: "/api/capability-packages/cache-probe/assets/icon.png",
    headers: { "if-none-match": iconEtag },
  });
  assert.equal(assetRevalidated.statusCode, 304);
  assert.equal(
    assetRevalidated.headers["x-content-type-options"],
    "nosniff",
    "nosniff must survive the 304 early return",
  );

  // ── contributions.assets (#5091): declared general assets serve with the
  //    same verification + caching chain as icons ──
  const tilesRes = await app.inject({
    method: "GET",
    url: "/api/capability-packages/cache-probe/assets/art/tiles.png?v=1.0.0",
  });
  assert.equal(tilesRes.statusCode, 200, "a declared contributions.assets image must serve");
  assert.equal(tilesRes.headers["content-type"], "image/png");
  assert.equal(tilesRes.headers["cache-control"], "private, no-cache, must-revalidate");
  assert.equal(tilesRes.headers.etag, `"${sha256(TILES)}"`);
  assert.ok(TILES.equals(tilesRes.rawPayload), "the served body must be the hash-verified declared bytes");

  const tilemapRes = await app.inject({
    method: "GET",
    url: "/api/capability-packages/cache-probe/assets/art/zone.json",
  });
  assert.equal(tilemapRes.statusCode, 200, "declared JSON metadata must serve");
  assert.equal(tilemapRes.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(tilemapRes.headers["x-content-type-options"], "nosniff");
  assert.equal(tilemapRes.body, TILEMAP);

  const secretRes = await app.inject({
    method: "GET",
    url: "/api/capability-packages/cache-probe/assets/art/secret.png",
  });
  assert.equal(secretRes.statusCode, 404, "a file on disk and in files[] but NOT declared must stay unservable");

  // Traversal, two layers deep. At the HTTP layer the framework collapses
  // dot-segments before routing, so a %2e%2e URL can only ever reach the
  // DECLARED asset — pin that it serves exactly those bytes and nothing else.
  const collapsedRes = await app.inject({
    method: "GET",
    url: "/api/capability-packages/cache-probe/assets/art/%2e%2e/art/tiles.png",
  });
  assert.equal(collapsedRes.statusCode, 200, "the framework collapses dot-segments to the declared path");
  assert.equal(collapsedRes.headers.etag, `"${sha256(TILES)}"`, "a collapsed URL must serve the declared bytes only");
  // The resolver's own containment (independent of framework normalization):
  // dot-segment and escape paths must resolve to nothing, never throw.
  const { capabilityPackageManager } = await import(
    "../../packages/server/src/services/capability-packages/package-manager.service.js"
  );
  assert.equal(await capabilityPackageManager.packageAsset("cache-probe", "art/../art/tiles.png"), null);
  assert.equal(await capabilityPackageManager.packageAsset("cache-probe", "../installed.json"), null);

  const manifestJsonRes = await app.inject({
    method: "GET",
    url: "/api/capability-packages/cache-probe/assets/manifest.json",
  });
  assert.equal(manifestJsonRes.statusCode, 404, "the in-package manifest itself must never be servable");

  // Schema gates (install-time): active document extensions are rejected, and a
  // declared asset missing from files[] fails the manifest, not runtime 404s.
  const { capabilityPackageManifestSchema } = await import(
    "../../packages/shared/src/schemas/capability-package.schema.js"
  );
  const svgAttempt = capabilityPackageManifestSchema.safeParse({
    ...manifestV1,
    contributions: { ...manifestV1.contributions, assets: { paths: ["art/vector.svg"] } },
  });
  assert.equal(svgAttempt.success, false, "svg (an active document) must be rejected by the schema");
  const unpinnedAttempt = capabilityPackageManifestSchema.safeParse({
    ...manifestV1,
    contributions: { ...manifestV1.contributions, assets: { paths: ["art/ghost.png"] } },
  });
  assert.equal(unpinnedAttempt.success, false, "a declared asset absent from files[] must fail at install");
  // The 1.10 gate: assets on a v2 manifest declaring an older capabilityApi, or
  // on a v1 manifest (which cannot declare one at all), must fail with the
  // versioned message rather than shipping an undeclared 1.10 dependency.
  const tooOldApiAttempt = capabilityPackageManifestSchema.safeParse({
    ...manifestV1,
    capabilityApi: { major: 1, minor: 9 },
  });
  assert.equal(tooOldApiAttempt.success, false, "contributions.assets must require capabilityApi ≥ 1.10");
  const { capabilityApi: _api, builtAgainst: _built, ...v1Fields } = manifestV1;
  const v1WithAssets = capabilityPackageManifestSchema.safeParse({ ...v1Fields, schemaVersion: 1 });
  assert.equal(v1WithAssets.success, false, "a schemaVersion 1 manifest cannot declare contributions.assets");
  const validManifest = capabilityPackageManifestSchema.safeParse(manifestV1);
  assert.equal(validManifest.success, true, "the fixture manifest itself must parse");

  // ── update: new bytes under a new version yield a NEW validator, and the
  //    old validator no longer short-circuits to 304 ──
  const manifestV2 = writeFixture("1.0.1", CLIENT_V2);
  const updatedEtag = `"${manifestV2.files[0]!.sha256}"`;
  assert.notEqual(updatedEtag, clientEtag);
  const afterUpdate = await app.inject({
    method: "GET",
    url: "/api/capability-packages/cache-probe/client?v=1.0.1",
    headers: { "if-none-match": clientEtag },
  });
  assert.equal(afterUpdate.statusCode, 200, "a stale validator must not mask an updated bundle");
  assert.equal(afterUpdate.headers.etag, updatedEtag);
  assert.equal(afterUpdate.body, CLIENT_V2);

  // ── existing failure modes preserved ──
  const unknown = await app.inject({ method: "GET", url: "/api/capability-packages/nope/client" });
  assert.equal(unknown.statusCode, 404);
  const undeclared = await app.inject({
    method: "GET",
    url: "/api/capability-packages/cache-probe/assets/client.js",
  });
  assert.equal(undeclared.statusCode, 404, "files outside the asset allowlist (and active types) are not servable");

  await app.close();
  console.log("capability-package-cache regression passed");
}

main()
  .then(() => {
    rmSync(dataDir, { recursive: true, force: true });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
