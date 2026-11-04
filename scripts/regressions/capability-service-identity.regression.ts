/**
 * Capability API 1.816: a service learns which package is calling from the Engine, not from the caller; a package
 * registers only keys under its own id; and a package can list readable keys and ask whether a peer is active.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapabilityRuntimeHost } from "../../packages/shared/src/types/capability-runtime.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-service-identity-"));
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
const { runWithRoomGeneration } = await import("../../packages/server/src/services/multiplayer/generation-policy.js");
const { supportedCapabilityApi } = await import("../../packages/shared/src/schemas/capability-package.schema.js");

assert.ok(supportedCapabilityApi.major === 1 && supportedCapabilityApi.minor >= 816, "ships as capability API 1.816");

const timestamp = new Date().toISOString();

function fixturePackage(id: string, source: string, minor: number | null) {
  const files = [
    { path: "server.mjs", bytes: Buffer.byteLength(source), sha256: createHash("sha256").update(source).digest("hex") },
  ];
  const base = {
    id,
    name: id,
    version: "1.0.0",
    description: "Service identity proof",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { server: "server.mjs" },
    permissions: ["chat-read"],
    restartRequired: false,
    files,
  };
  const manifest =
    minor === null
      ? { schemaVersion: 1, ...base }
      : {
          schemaVersion: 2,
          capabilityApi: { major: 1, minor },
          builtAgainst: { engineVersion: "2.3.0", engineCommit: "a".repeat(40) },
          ...base,
        };
  const root = join(dir, "capability-packages", "versions", id, "1.0.0");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "server.mjs"), source);
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
  return {
    id,
    version: "1.0.0",
    manifest,
    installedAt: timestamp,
    status: "active",
    readiness: "ready",
    error: null,
    legacy: false,
  };
}

const providerSource = `export function activate(context) {
  context.api.registerService("identity-provider:intake", { raw: true }, {
    forCaller(caller) {
      return caller.packageId === "identity-consumer" ? { allowedFor: caller.packageId, version: caller.packageVersion } : null;
    },
  });
  context.api.registerService("identity-provider:hidden", { secret: 1 }, { hostOnly: true });
  context.api.registerService("identity-provider:open", { open: true });
  context.api.registerService("identity-provider:runtime", context.api.runtime);
}
`;
// The consumer claims to be the provider's favourite: nothing it sends can change who the Engine says it is.
const consumerSource = `export function activate(context) {
  context.api.registerService("identity-consumer:runtime", context.api.runtime);
}
`;
const otherSource = `export function activate(context) {
  context.api.registerService("identity-other:runtime", context.api.runtime);
}
`;
const squatterNewSource = `export function activate(context) {
  context.api.registerService("identity-provider:recall", { squatted: true });
}
`;
const squatterOldSource = `export function activate(context) {
  context.api.registerService("identity-provider:legacy", { squatted: true });
  context.api.registerService("identity-squatter-old:runtime", context.api.runtime);
}
`;
const packages = [
  fixturePackage("identity-provider", providerSource, 816),
  fixturePackage("identity-consumer", consumerSource, 816),
  fixturePackage("identity-other", otherSource, null),
  fixturePackage("identity-squatter-new", squatterNewSource, 816),
  fixturePackage("identity-squatter-old", squatterOldSource, 815),
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
  for (const id of ["identity-provider", "identity-consumer", "identity-other"]) {
    assert.equal((await capabilityModuleRuntime.activatePackage(app, id)).readiness, "ready", id);
  }
  const consumer = getCapabilityService<CapabilityRuntimeHost>("identity-consumer:runtime");
  const other = getCapabilityService<CapabilityRuntimeHost>("identity-other:runtime");
  const provider = getCapabilityService<CapabilityRuntimeHost>("identity-provider:runtime");
  assert.ok(consumer && other && provider);

  // ── forCaller gets the identity the Engine assigned, memoized per consumer ──
  const seen = consumer.services?.get<{ allowedFor: string; version: string }>("identity-provider:intake");
  assert.deepEqual(seen, { allowedFor: "identity-consumer", version: "1.0.0" });
  assert.equal(consumer.services?.get("identity-provider:intake"), seen, "resolved once per consumer");
  assert.equal(other.services?.get("identity-provider:intake"), null, "a consumer forCaller turns away gets null");
  // The Engine reads the raw service.
  assert.deepEqual(getCapabilityService("identity-provider:intake"), { raw: true });
  // A service without forCaller is the same object for everyone, as before.
  assert.equal(consumer.services?.get("identity-provider:open"), other.services?.get("identity-provider:open"));

  // ── services.list hides host-only keys and Engine-reserved prefixes ──
  assert.deepEqual(consumer.services?.list?.("identity-provider:"), [
    "identity-provider:intake",
    "identity-provider:open",
    "identity-provider:runtime",
  ]);
  assert.deepEqual(consumer.services?.list?.("agent-runtime:"), []);

  // ── packages.isActive follows activation ──
  assert.equal(consumer.packages?.isActive("identity-provider"), true);
  assert.equal(consumer.packages?.isActive("identity-missing"), false);

  // ── every seam is off during a shared-room generation ──
  const room = {
    roomId: "room",
    epoch: "1",
    operationId: "op",
    chatId: "chat",
    characterIds: [],
    characters: [],
    lorebookIds: [],
    participants: [],
    memories: {},
  };
  await runWithRoomGeneration(room, async () => {
    assert.equal(consumer.services?.get("identity-provider:open"), null);
    assert.deepEqual(consumer.services?.list?.("identity-provider:"), []);
    assert.equal(consumer.packages?.isActive("identity-provider"), false);
  });

  // ── a package declaring 1.816 cannot register another package's key ──
  await assert.rejects(
    capabilityModuleRuntime.activatePackage(app, "identity-squatter-new"),
    /must register services under its own "identity-squatter-new:" prefix/,
  );
  assert.equal(getCapabilityService("identity-provider:recall"), null);
  // ── an older package still activates, with a warning ──
  assert.equal((await capabilityModuleRuntime.activatePackage(app, "identity-squatter-old")).readiness, "ready");
  assert.ok(warnings.some((line) => line.includes("identity-squatter-old") && line.includes("own")));

  // ── once the provider is gone, so is its service and its active flag ──
  await capabilityModuleRuntime.deactivatePackage("identity-provider");
  assert.equal(consumer.services?.get("identity-provider:intake"), null);
  assert.equal(consumer.packages?.isActive("identity-provider"), false);
} finally {
  (logger as unknown as { warn: unknown }).warn = originalWarn;
  await capabilityModuleRuntime.stop();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Services learn their caller from the Engine; keys stay under their owner's id; peers are discoverable.");
