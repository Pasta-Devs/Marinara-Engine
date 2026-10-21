// The install route says why it refuses a package version this Engine cannot run, before downloading it: 409 with
// the same capability API message the update check uses, never the error handler's "Internal Server Error".
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-capability-install-refusal-"));
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = "production";
process.env.LOG_LEVEL = "silent";

const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const fastify = serverRequire("fastify") as typeof import("fastify").default;
const { capabilityPackagesRoutes } = await import("../../packages/server/src/routes/capability-packages.routes.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { capabilityPackageManager, findCompatibleCapabilityPackageUpdates } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { capabilityPackageManifestSchema, getCapabilityApiCompatibilityIssue, supportedCapabilityApi } =
  await import("../../packages/shared/src/schemas/capability-package.schema.js");

const sha = "a".repeat(64);
function entry(id: string, overrides: Record<string, unknown>) {
  return {
    manifest: capabilityPackageManifestSchema.parse({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor: supportedCapabilityApi.minor },
      builtAgainst: { engineVersion: "2.5.0", engineCommit: "b".repeat(40) },
      id,
      name: id,
      version: "1.0.1",
      description: "Install refusal regression fixture.",
      engine: { min: "2.3.0", maxExclusive: "99.0.0" },
      kind: ["agent"],
      entrypoints: { client: "client.js" },
      files: [{ path: "client.js", sha256: sha, bytes: 1 }],
      permissions: [],
      restartRequired: false,
      ...overrides,
    }),
    artifact: { url: "https://invalid.example/never-download.zip", sha256: sha, bytes: 1 },
  };
}
const newerApi = entry("newer-api", { capabilityApi: { major: 1, minor: supportedCapabilityApi.minor + 1 } });
const newerEngine = entry("newer-engine", { engine: { min: "98.0.0", maxExclusive: "99.0.0" } });
const catalog = { schemaVersion: 1, generatedAt: "2026-10-20T00:00:00.000Z", packages: [newerApi, newerEngine] };

const originalCatalog = capabilityPackageManager.catalog;
const originalFetch = globalThis.fetch;
let downloads = 0;
capabilityPackageManager.catalog = async () => catalog as never;
globalThis.fetch = (async () => {
  downloads += 1;
  throw new Error("a refused package must not be downloaded");
}) as typeof fetch;

const app = fastify({ logger: false });
app.setErrorHandler(errorHandler);
await app.register(capabilityPackagesRoutes, { prefix: "/api/capability-packages" });
try {
  const install = (id: string) =>
    app.inject({
      method: "POST",
      url: `/api/capability-packages/${id}/install`,
      payload: { expectedVersion: "1.0.1", expectedArtifactSha256: sha },
    });

  const apiMessage = getCapabilityApiCompatibilityIssue(newerApi.manifest);
  assert.equal(
    apiMessage,
    `Package requires capability API 1.${supportedCapabilityApi.minor + 1}; this Engine supports 1.${supportedCapabilityApi.minor}`,
  );
  const refusedApi = await install("newer-api");
  assert.equal(refusedApi.statusCode, 409, refusedApi.body);
  assert.deepEqual(refusedApi.json(), { error: apiMessage });

  const refusedEngine = await install("newer-engine");
  assert.equal(refusedEngine.statusCode, 409, refusedEngine.body);
  assert.deepEqual(refusedEngine.json(), { error: "Package requires Marinara Engine 98.0.0 to below 99.0.0" });
  assert.equal(downloads, 0, "the refusal comes before the download");

  // The update check refuses the same versions, so the two never disagree.
  const installed = [newerApi, newerEngine].map((item) => ({
    id: item.manifest.id,
    version: "1.0.0",
    manifest: { ...item.manifest, version: "1.0.0", capabilityApi: { major: 1, minor: 1 } },
  }));
  assert.deepEqual(findCompatibleCapabilityPackageUpdates(installed as never, catalog as never), []);

  // A failure that is not a refusal still goes through the error handler unchanged.
  capabilityPackageManager.catalog = async () => {
    throw new Error("catalog offline");
  };
  const broken = await install("newer-api");
  assert.equal(broken.statusCode, 500);
  assert.deepEqual(broken.json(), { error: "Internal Server Error" });
} finally {
  capabilityPackageManager.catalog = originalCatalog;
  globalThis.fetch = originalFetch;
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log("Refused package installs answer 409 with the capability API or Engine version they need.");
