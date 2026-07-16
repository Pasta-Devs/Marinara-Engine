import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-capability-lifecycle-"));
process.env.DATA_DIR = dataDir;

const packagesRoot = join(dataDir, "capability-packages");
const registryPath = join(packagesRoot, "installed.json");
const modelsRoot = join(dataDir, "models");
const speechConfigPath = join(modelsRoot, "sidecar-speech-config.json");

function installedPackage(id: string, kind: string[], version = "1.0.0") {
  return {
    id,
    version,
    manifest: {
      schemaVersion: 1,
      id,
      name: id,
      version,
      description: "Capability lifecycle regression fixture.",
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind,
      entrypoints: { server: "server.mjs", client: "client.js" },
      files: [
        { path: "server.mjs", sha256: "0".repeat(64), bytes: 1 },
        { path: "client.js", sha256: "0".repeat(64), bytes: 1 },
      ],
      permissions: ["ui"],
      restartRequired: true,
    },
    installedAt: "2026-07-14T00:00:00.000Z",
    status: "active",
    error: null,
    legacy: false,
  };
}

function writeRegistry(packages: ReturnType<typeof installedPackage>[]) {
  mkdirSync(packagesRoot, { recursive: true });
  writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, packages }, null, 2));
  for (const item of packages) {
    const versionRoot = join(packagesRoot, "versions", item.id, item.version);
    mkdirSync(versionRoot, { recursive: true });
    writeFileSync(join(versionRoot, "server.mjs"), "x");
    writeFileSync(join(versionRoot, "client.js"), "x");
  }
}

function seedWhisperModels() {
  for (const modelName of ["whisper-tiny", "whisper-base"]) {
    const modelRoot = join(modelsRoot, "Xenova", modelName);
    mkdirSync(modelRoot, { recursive: true });
    writeFileSync(join(modelRoot, "model.onnx"), "fixture");
  }
  writeFileSync(speechConfigPath, JSON.stringify({ modelId: "whisper_tiny" }));
}

try {
  const {
    capabilityCatalogSchema,
    capabilityPackageManifestSchema,
    compareCapabilityPackageVersions,
    getCapabilityApiCompatibilityIssue,
    installedCapabilityPackageSchema,
    supportedCapabilityApi,
  } = await import(
    "../../packages/shared/src/schemas/capability-package.schema.js"
  );
  assert.equal(compareCapabilityPackageVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareCapabilityPackageVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareCapabilityPackageVersions("1.0.1", "1.0.1"), 0);
  assert.equal(compareCapabilityPackageVersions("1.0.1", "1.0.1-beta.2"), 1);
  assert.equal(compareCapabilityPackageVersions("1.0.1-beta.10", "1.0.1-beta.2"), 1);

  const legacyManifest = capabilityPackageManifestSchema.parse(installedPackage("legacy", ["agent"]).manifest);
  assert.equal(legacyManifest.schemaVersion, 1, "Existing manifest v1 packages must remain readable");
  assert.equal(getCapabilityApiCompatibilityIssue(legacyManifest), null);
  assert.deepEqual(supportedCapabilityApi, { major: 1, minor: 0 });

  const manifestV2 = capabilityPackageManifestSchema.parse({
    ...legacyManifest,
    schemaVersion: 2,
    capabilityApi: { major: 1, minor: 0 },
    builtAgainst: {
      engineVersion: "2.3.0",
      engineCommit: "a".repeat(40),
    },
  });
  assert.equal(getCapabilityApiCompatibilityIssue(manifestV2), null);
  assert.throws(
    () =>
      capabilityPackageManifestSchema.parse({
        ...legacyManifest,
        schemaVersion: 2,
        capabilityApi: { major: 1, minor: 0 },
      }),
    /builtAgainst/,
    "Manifest v2 must record exact Engine build provenance",
  );

  const unsupportedMajorManifest = capabilityPackageManifestSchema.parse({
    ...manifestV2,
    capabilityApi: { major: 2, minor: 0 },
  });
  assert.match(
    getCapabilityApiCompatibilityIssue(unsupportedMajorManifest) ?? "",
    /requires capability API 2\.0; this Engine supports 1\.0/,
  );
  const unsupportedMinorManifest = capabilityPackageManifestSchema.parse({
    ...manifestV2,
    capabilityApi: { major: 1, minor: 1 },
  });
  assert.match(
    getCapabilityApiCompatibilityIssue(unsupportedMinorManifest) ?? "",
    /requires capability API 1\.1; this Engine supports 1\.0/,
  );

  const forwardCompatibleCatalog = capabilityCatalogSchema.parse({
    schemaVersion: 1,
    generatedAt: "2026-07-16T00:00:00.000Z",
    packages: [
      {
        manifest: {
          ...manifestV2,
          id: "hierarchical-maps",
          name: "Hierarchical Maps",
          version: "1.1.1",
          engine: { min: "3.2.0", maxExclusive: "3.3.0" },
          capabilityApi: { major: 1, minor: 3 },
          contributions: {
            slots: ["chat-settings", "spatial-workspace", "chat-runtime", "game-world-map"],
            agentDetail: { agentIds: ["hierarchical-maps"] },
          },
        },
        category: "tracker",
        artifact: {
          url: "https://example.com/hierarchical-maps-1.1.1.zip",
          sha256: "1".repeat(64),
          bytes: 1,
        },
      },
    ],
  });
  assert.deepEqual(
    forwardCompatibleCatalog.packages[0]?.manifest.contributions?.agentDetail,
    { agentIds: ["hierarchical-maps"] },
    "Stable Engines must parse newer agent-detail metadata before applying compatibility gates",
  );
  assert.match(
    getCapabilityApiCompatibilityIssue(forwardCompatibleCatalog.packages[0]!.manifest) ?? "",
    /requires capability API 1\.3; this Engine supports 1\.0/,
    "Parsing newer contribution metadata must not bypass capability API compatibility gates",
  );

  writeRegistry([installedPackage("conversation-calls", ["agent", "conversation-calls"])]);
  seedWhisperModels();

  const { capabilityPackageManager, findCompatibleCapabilityPackageUpdates } = await import(
    "../../packages/server/src/services/capability-packages/package-manager.service.js"
  );
  const catalogEntry = (manifest: typeof legacyManifest) => ({
    manifest,
    category: "misc",
    artifact: {
      url: `https://example.com/${manifest.id}-${manifest.version}.zip`,
      sha256: "1".repeat(64),
      bytes: 1,
    },
  });
  const callsUpdateManifest = capabilityPackageManifestSchema.parse({
    ...legacyManifest,
    id: "conversation-calls",
    name: "conversation-calls",
    version: "1.0.2",
    kind: ["agent", "conversation-calls"],
  });
  const futureEngineManifest = capabilityPackageManifestSchema.parse({
    ...legacyManifest,
    id: "future-engine",
    name: "future-engine",
    version: "1.1.0",
    engine: { min: "2.4.0", maxExclusive: "3.0.0" },
  });
  const futureCapabilityManifest = capabilityPackageManifestSchema.parse({
    ...unsupportedMajorManifest,
    id: "future-contract",
    name: "future-contract",
    version: "1.1.0",
  });
  const coreUpdateManifest = capabilityPackageManifestSchema.parse({
    ...legacyManifest,
    id: "about-me-keeper",
    name: "about-me-keeper",
    version: "1.1.0",
  });
  const updateCatalog = capabilityCatalogSchema.parse({
    schemaVersion: 1,
    generatedAt: "2026-07-16T00:00:00.000Z",
    packages: [
      catalogEntry(callsUpdateManifest),
      forwardCompatibleCatalog.packages[0]!,
      catalogEntry(futureEngineManifest),
      catalogEntry(futureCapabilityManifest),
      catalogEntry(coreUpdateManifest),
    ],
  });
  const updateCandidates = findCompatibleCapabilityPackageUpdates(
    [
      installedCapabilityPackageSchema.parse(installedPackage("conversation-calls", ["agent", "conversation-calls"])),
      installedCapabilityPackageSchema.parse(installedPackage("future-engine", ["agent"])),
      installedCapabilityPackageSchema.parse(installedPackage("future-contract", ["agent"])),
      installedCapabilityPackageSchema.parse(installedPackage("about-me-keeper", ["agent"])),
      installedCapabilityPackageSchema.parse(installedPackage("not-in-catalog", ["agent"])),
    ],
    updateCatalog,
    "2.3.1",
  );
  assert.deepEqual(
    updateCandidates.map(({ installed, entry }) => [installed.id, installed.version, entry.manifest.version]),
    [["conversation-calls", "1.0.0", "1.0.2"]],
    "Automatic updates must select only newer, compatible, downloadable packages already installed by the user",
  );
  const unsupportedInstalled = installedCapabilityPackageSchema.parse({
    ...installedPackage("future-contract", ["agent"]),
    manifest: unsupportedMajorManifest,
  });
  assert.match(
    capabilityPackageManager.runtimeBlockReason(unsupportedInstalled) ?? "",
    /requires capability API 2\.0/,
    "Unsupported capability APIs must be blocked before runtime import",
  );
  const removedCalls = await capabilityPackageManager.uninstall("conversation-calls");
  assert.ok(removedCalls, "Conversation Calls should be removed");
  assert.equal(existsSync(join(modelsRoot, "Xenova", "whisper-tiny")), false);
  assert.equal(existsSync(join(modelsRoot, "Xenova", "whisper-base")), false);
  assert.equal(existsSync(speechConfigPath), false);
  assert.equal(existsSync(join(packagesRoot, "versions", "conversation-calls")), false);
  assert.deepEqual(JSON.parse(readFileSync(registryPath, "utf8")).packages, []);

  writeRegistry([installedPackage("uno", ["agent", "turn-game"])]);
  seedWhisperModels();
  const removedUno = await capabilityPackageManager.uninstall("uno");
  assert.ok(removedUno, "Unrelated packages should still be removed");
  assert.equal(
    existsSync(join(modelsRoot, "Xenova", "whisper-tiny")),
    true,
    "Uninstalling a package other than Conversation Calls must preserve Whisper",
  );

  const blocked = installedPackage("hierarchical-maps", ["agent", "maps"]);
  const failing = installedPackage("readiness-failure", ["agent"]);
  const ready = installedPackage("readiness-success", ["agent"]);
  writeRegistry([blocked, failing, ready]);
  writeFileSync(
    join(packagesRoot, "versions", failing.id, failing.version, "server.mjs"),
    `export async function activate({ api }) {
      api.registerService("readiness:failure", { active: true });
    }
    export async function selfCheck() {
      throw new Error("fixture snapshot read failed");
    }`,
  );
  writeFileSync(
    join(packagesRoot, "versions", ready.id, ready.version, "server.mjs"),
    `export async function activate({ api }) {
      api.registerService("readiness:success", { active: true });
    }
    export async function selfCheck() {}`,
  );

  const { capabilityModuleRuntime } = await import(
    "../../packages/server/src/services/capability-packages/capability-module-runtime.service.js"
  );
  const { getCapabilityService } = await import(
    "../../packages/server/src/services/capability-packages/capability-service-registry.service.js"
  );
  await capabilityModuleRuntime.start({} as Parameters<typeof capabilityModuleRuntime.start>[0]);

  const readinessById = new Map((await capabilityPackageManager.installed()).map((item) => [item.id, item]));
  assert.equal(readinessById.get("hierarchical-maps")?.status, "error");
  assert.equal(readinessById.get("hierarchical-maps")?.readiness, "error");
  assert.match(readinessById.get("hierarchical-maps")?.readinessError ?? "", /incompatible with file-native storage/);
  assert.equal(readinessById.get("readiness-failure")?.readiness, "error");
  assert.match(readinessById.get("readiness-failure")?.readinessError ?? "", /fixture snapshot read failed/);
  assert.equal(readinessById.get("readiness-success")?.status, "active");
  assert.equal(readinessById.get("readiness-success")?.readiness, "ready");

  assert.equal(getCapabilityService("readiness:failure"), null, "Failed self-check contributions must be removed");
  assert.deepEqual(getCapabilityService("readiness:success"), { active: true });
  assert.equal(await capabilityPackageManager.clientEntrypoint("hierarchical-maps"), null);
  assert.equal(await capabilityPackageManager.clientEntrypoint("readiness-failure"), null);
  assert.ok(await capabilityPackageManager.clientEntrypoint("readiness-success"));

  const diagnostics = await capabilityPackageManager.diagnostics();
  assert.deepEqual(
    diagnostics.map((item) => ({ id: item.id, readiness: item.readiness, ready: item.ready, issue: item.issue })),
    [
      { id: "hierarchical-maps", readiness: "error", ready: false, issue: "runtime_error" },
      { id: "readiness-failure", readiness: "error", ready: false, issue: "runtime_error" },
      { id: "readiness-success", readiness: "ready", ready: true, issue: null },
    ],
  );
  assert.equal(JSON.stringify(diagnostics).includes("snapshot read failed"), false, "Health diagnostics must omit errors");

  const { getFileTableConfig, isFileTable } = await import("../../packages/server/src/db/file-schema.js");
  const packageTable = {};
  Object.defineProperty(packageTable, Symbol.for("marinara:file-table"), {
    value: { name: "package_fixture", columns: {}, uniqueConstraints: [] },
  });
  assert.equal(isFileTable(packageTable), true, "Package-bundled file tables must share the host table identity");
  assert.equal(getFileTableConfig(packageTable as never).name, "package_fixture");

  await capabilityModuleRuntime.stop();
  assert.equal(getCapabilityService("readiness:success"), null, "Runtime stop must remove ready contributions");

  console.info("Capability package lifecycle and readiness regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
