/**
 * Capability API 1.819: `contributions.services`. A provided key must carry the package's own id, providers activate
 * before the consumers that require them, and the per-pair sharing switch is enforced in `runtime.services.get`:
 * a consumer switched off reads null while the Engine and every other consumer are unaffected.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapabilityRuntimeHost } from "../../packages/shared/src/types/capability-runtime.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-service-sharing-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = serverRequire("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { logger } = await import("../../packages/server/src/lib/logger.js");
const { capabilityModuleRuntime } =
  await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
const { getCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const sharing =
  await import("../../packages/server/src/services/capability-packages/capability-service-sharing.service.js");
const { capabilityPackageManifestSchema, supportedCapabilityApi } =
  await import("../../packages/shared/src/schemas/capability-package.schema.js");

assert.ok(supportedCapabilityApi.major === 1 && supportedCapabilityApi.minor >= 819, "ships as capability API 1.819");

const timestamp = new Date().toISOString();

function manifestFor(id: string, source: string, services?: unknown, minor = 819) {
  return {
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.3.0", engineCommit: "a".repeat(40) },
    id,
    name: id,
    version: "1.0.0",
    description: "Service sharing proof",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { server: "server.mjs" },
    permissions: [],
    restartRequired: false,
    ...(services ? { contributions: { services } } : {}),
    files: [
      {
        path: "server.mjs",
        bytes: Buffer.byteLength(source),
        sha256: createHash("sha256").update(source).digest("hex"),
      },
    ],
  };
}

function fixturePackage(id: string, source: string, services?: unknown) {
  const manifest = manifestFor(id, source, services);
  const root = join(dir, "capability-packages", "versions", id, "1.0.0");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "server.mjs"), source);
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
  return { id, version: "1.0.0", manifest, installedAt: timestamp, status: "active", readiness: "ready", error: null };
}

// ── install validation ──
const messages = (error: { issues: Array<{ message: string }> }) =>
  error.issues.map(({ message }) => message).join("\n");
const valid = manifestFor("memory", "", {
  provides: [
    { key: "memory:recall", version: 1, description: "Reads memories" },
    { key: "memory:intake", version: 1, sharedByDefault: false },
  ],
  requires: [{ key: "feed:settings", version: 1, optional: true }],
});
assert.ok(capabilityPackageManifestSchema.safeParse(valid).success, "a well-formed services block installs");
const mismatched = capabilityPackageManifestSchema.safeParse(
  manifestFor("memory", "", { provides: [{ key: "other:recall", version: 1 }] }),
);
assert.ok(!mismatched.success && /must start with "memory:"/.test(messages(mismatched.error)));
const tooOld = capabilityPackageManifestSchema.safeParse(
  manifestFor("memory", "", { provides: [{ key: "memory:recall", version: 1 }] }, 818),
);
assert.ok(!tooOld.success && /capabilityApi 1\.819/.test(messages(tooOld.error)));
const twice = capabilityPackageManifestSchema.safeParse(
  manifestFor("memory", "", {
    provides: [
      { key: "memory:recall", version: 1 },
      { key: "memory:recall", version: 2 },
    ],
  }),
);
assert.ok(!twice.success && /listed twice/.test(messages(twice.error)));

// ── packages: a consumer listed before its provider, which it looks for in activate ──
const consumerSource = `export function activate(context) {
  context.api.registerService("share-consumer:runtime", context.api.runtime);
  context.api.registerService("share-consumer:found-at-activation", { found: context.api.runtime.services.get("share-provider:recall") !== null });
}
`;
const otherSource = `export function activate(context) {
  context.api.registerService("share-other:runtime", context.api.runtime);
}
`;
const providerSource = `export function activate(context) {
  context.api.registerService("share-provider:recall", { recall: true });
  context.api.registerService("share-provider:intake", { intake: true });
  context.api.registerService("share-provider:undeclared", { undeclared: true });
}
`;
const requires = { requires: [{ key: "share-provider:recall", version: 1 }] };
const providerServices = {
  provides: [
    { key: "share-provider:recall", version: 1 },
    { key: "share-provider:intake", version: 1, sharedByDefault: false },
  ],
};
const packages = [
  fixturePackage("share-consumer", consumerSource, requires),
  fixturePackage("share-other", otherSource, requires),
  fixturePackage("share-provider", providerSource, providerServices),
];
writeFileSync(join(dir, "capability-packages", "installed.json"), JSON.stringify({ schemaVersion: 1, packages }));

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
const warnings: string[] = [];
const originalWarn = logger.warn.bind(logger);
(logger as unknown as { warn: (...args: unknown[]) => void }).warn = (...args: unknown[]) => {
  warnings.push(args.map(String).join(" "));
  return originalWarn(...(args as Parameters<typeof logger.warn>));
};

try {
  // ── a cycle keeps the given order, with a warning ──
  const node = (id: string, need: string) =>
    ({
      installed: { id, manifest: { contributions: { services: { requires: [{ key: `${need}:x`, version: 1 }] } } } },
    }) as never;
  const cyclic = [node("a", "b"), node("b", "a")];
  assert.deepEqual(sharing.orderByServiceRequirements(cyclic), cyclic);
  assert.ok(warnings.some((line) => line.includes("form a cycle")));

  // ── start() activates the provider first ──
  await capabilityModuleRuntime.start(app);
  assert.deepEqual(getCapabilityService("share-consumer:found-at-activation"), { found: true });
  const consumer = getCapabilityService<CapabilityRuntimeHost>("share-consumer:runtime")!;
  const other = getCapabilityService<CapabilityRuntimeHost>("share-other:runtime")!;
  assert.ok(consumer && other);

  // ── defaults: recall shared, intake held back until the user switches it on, undeclared keys as before ──
  assert.deepEqual(consumer.services?.get("share-provider:recall"), { recall: true });
  assert.equal(consumer.services?.get("share-provider:intake"), null);
  assert.equal(other.services?.get("share-provider:intake"), null);
  assert.deepEqual(consumer.services?.get("share-provider:undeclared"), { undeclared: true });
  assert.deepEqual(consumer.services?.list?.("share-provider:"), [
    "share-provider:recall",
    "share-provider:undeclared",
  ]);

  // ── switching one pair: that consumer only; the Engine still reads the raw service ──
  await sharing.setCapabilityServiceShared(db, "share-provider:recall", "share-consumer", false);
  assert.equal(consumer.services?.get("share-provider:recall"), null);
  assert.deepEqual(other.services?.get("share-provider:recall"), { recall: true });
  assert.deepEqual(getCapabilityService("share-provider:recall"), { recall: true });
  await sharing.setCapabilityServiceShared(db, "share-provider:intake", "share-other", true);
  assert.deepEqual(other.services?.get("share-provider:intake"), { intake: true });
  assert.equal(consumer.services?.get("share-provider:intake"), null);

  // ── usage is two aggregates per pair, from reads that returned the service ──
  const state = await sharing.capabilityServiceSharingState(db);
  assert.deepEqual(
    state.overrides.sort((a, b) => a.key.localeCompare(b.key)),
    [
      { key: "share-provider:intake", consumerId: "share-other", shared: true },
      { key: "share-provider:recall", consumerId: "share-consumer", shared: false },
    ],
  );
  const recallByOther = state.usage.find(
    (entry) => entry.key === "share-provider:recall" && entry.consumerId === "share-other",
  );
  assert.equal(recallByOther?.usesThisWeek, 1);
  assert.ok(!state.usage.some((entry) => entry.key === "share-provider:undeclared"), "undeclared keys are not counted");
  // A week-old day drops out of the count.
  sharing.recordCapabilityServiceUse("share-provider:recall", "share-other", new Date(Date.now() - 10 * 86_400_000));
  sharing.recordCapabilityServiceUse("share-provider:recall", "share-other");
  const later = await sharing.capabilityServiceSharingState(db);
  assert.equal(
    later.usage.find((entry) => entry.key === "share-provider:recall" && entry.consumerId === "share-other")
      ?.usesThisWeek,
    2,
  );

  // ── a pair the user set survives a provider update that changes the default, and a restart ──
  await capabilityModuleRuntime.stop();
  sharing.resetCapabilityServiceSharing();
  await sharing.loadCapabilityServiceSharing(db);
  const updated = {
    ...packages[2]!,
    manifest: {
      ...packages[2]!.manifest,
      contributions: { services: { provides: [{ key: "share-provider:recall", version: 1, sharedByDefault: false }] } },
    },
  };
  const release = sharing.declareProvidedCapabilityServices(updated as never);
  assert.equal(sharing.isCapabilityServiceSharedWith("share-provider:recall", "share-consumer"), false, "still off");
  assert.equal(sharing.isCapabilityServiceSharedWith("share-provider:recall", "share-other"), false, "new default");
  assert.equal(sharing.isCapabilityServiceSharedWith("share-provider:recall", "share-provider"), true, "own reads");
  release();
  assert.equal(sharing.isCapabilityServiceSharedWith("share-provider:recall", "share-other"), true, "undeclared");
  assert.ok(
    (await sharing.capabilityServiceSharingState(db)).usage.some((entry) => entry.consumerId === "share-other"),
    "usage was saved at stop",
  );
} finally {
  (logger as unknown as { warn: unknown }).warn = originalWarn;
  await capabilityModuleRuntime.stop();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Service declarations order activation, and each sharing switch reaches exactly its pair.");
