import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-capability-lifecycle-"));
process.env.DATA_DIR = dataDir;

const packagesRoot = join(dataDir, "capability-packages");
const registryPath = join(packagesRoot, "installed.json");
const migrationPath = join(packagesRoot, "availability-migration-v1.json");
const mapsCorrectionPath = join(packagesRoot, "hierarchical-maps-selection-correction-v1.json");
const modelsRoot = join(dataDir, "models");
const speechConfigPath = join(modelsRoot, "sidecar-speech-config.json");
let closeDatabase: (() => Promise<void>) | null = null;

function installedPackage(id: string, kind: string[], version = "1.0.0", restartRequired = true) {
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
      restartRequired,
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
  } = await import("../../packages/shared/src/schemas/capability-package.schema.js");
  assert.equal(compareCapabilityPackageVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareCapabilityPackageVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareCapabilityPackageVersions("1.0.1", "1.0.1"), 0);
  assert.equal(compareCapabilityPackageVersions("1.0.1", "1.0.1-beta.2"), 1);
  assert.equal(compareCapabilityPackageVersions("1.0.1-beta.10", "1.0.1-beta.2"), 1);

  const legacyManifest = capabilityPackageManifestSchema.parse(installedPackage("legacy", ["agent"]).manifest);
  assert.equal(legacyManifest.schemaVersion, 1, "Existing manifest v1 packages must remain readable");
  assert.equal(getCapabilityApiCompatibilityIssue(legacyManifest), null);
  assert.deepEqual(supportedCapabilityApi, { major: 1, minor: 3 });

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
  const currentManifestV2 = capabilityPackageManifestSchema.parse({
    ...manifestV2,
    capabilityApi: { major: 1, minor: 3 },
    contributions: { agentDetail: { agentIds: ["feature-agent"] } },
  });
  assert.equal(getCapabilityApiCompatibilityIssue(currentManifestV2), null);
  assert.deepEqual(currentManifestV2.contributions?.agentDetail?.agentIds, ["feature-agent"]);
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
    /requires capability API 2\.0; this Engine supports 1\.3/,
  );
  const unsupportedMinorManifest = capabilityPackageManifestSchema.parse({
    ...manifestV2,
    capabilityApi: { major: 1, minor: 4 },
  });
  assert.match(
    getCapabilityApiCompatibilityIssue(unsupportedMinorManifest) ?? "",
    /requires capability API 1\.4; this Engine supports 1\.3/,
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
  assert.deepStrictEqual(
    forwardCompatibleCatalog.packages[0]?.manifest.contributions?.agentDetail,
    { agentIds: ["hierarchical-maps"] },
    "Capability API 1.3 Engines must parse agent-detail metadata before applying compatibility gates",
  );
  assert.strictEqual(
    getCapabilityApiCompatibilityIssue(forwardCompatibleCatalog.packages[0]!.manifest),
    null,
    "Capability API 1.3 agent-detail metadata must remain compatible with the 1.3 host",
  );

  writeRegistry([installedPackage("conversation-calls", ["agent", "conversation-calls"])]);
  seedWhisperModels();

  const {
    capabilityPackageManager,
    findCompatibleCapabilityPackageUpdates,
    resolveCapabilityCatalogUrl,
  } = await import(
    "../../packages/server/src/services/capability-packages/package-manager.service.js"
  );
  assert.equal(
    resolveCapabilityCatalogUrl("2.3.1", ""),
    "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/catalog/v2/catalog.json",
  );
  assert.equal(
    resolveCapabilityCatalogUrl("3.2.2-beta.1", ""),
    "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/catalog/v3/catalog.json",
  );
  assert.equal(
    resolveCapabilityCatalogUrl("development", ""),
    "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/catalog/catalog.json",
    "Non-release builds must fall back to the legacy catalog instead of requesting a nonexistent lane",
  );
  assert.equal(
    resolveCapabilityCatalogUrl("3.2.2", " https://catalog.example.test/custom.json "),
    "https://catalog.example.test/custom.json",
    "An operator catalog override must remain exact and take precedence over Engine lane selection",
  );
  const {
    buildHierarchicalMapsSelectionCorrectionPatch,
    buildLegacyChatCapabilityPatch,
    correctLegacyHierarchicalMapsSelections,
  } = await import("../../packages/server/src/services/capability-packages/legacy-capability-chat-migration.js");
  const { migrateLegacyCapabilities } =
    await import("../../packages/server/src/services/capability-packages/legacy-capability-migration.js");

  assert.equal(
    buildLegacyChatCapabilityPatch({
      mode: "roleplay",
      metadata: { enableAgents: false, activeAgentIds: ["illustrator", "custom-agent"] },
    }),
    null,
    "Legacy capability migration must preserve a chat that did not select Hierarchical Maps",
  );
  assert.deepEqual(
    buildLegacyChatCapabilityPatch({ mode: "conversation", metadata: { activeAgentIds: [] } }),
    {
      activeAgentIds: ["uno", "chess", "poker", "eightball", "tic-tac-toe", "rock-paper-scissors"],
    },
    "The Maps fix must preserve migration of conversation games that were previously implicit",
  );
  assert.deepEqual(
    buildHierarchicalMapsSelectionCorrectionPatch(
      {
        mode: "roleplay",
        metadata: { enableAgents: false, activeAgentIds: ["illustrator", "hierarchical-maps"] },
      },
      false,
    ),
    { activeAgentIds: ["illustrator"] },
    "The correction must remove an auto-added Maps selection when the chat has no map data",
  );
  assert.equal(
    buildHierarchicalMapsSelectionCorrectionPatch(
      {
        mode: "roleplay",
        metadata: {
          activeAgentIds: ["hierarchical-maps"],
          spatialContext: { locations: [{ id: "existing-location" }] },
        },
      },
      false,
    ),
    null,
    "The correction must preserve Maps when a spatial definition exists",
  );
  assert.equal(
    buildHierarchicalMapsSelectionCorrectionPatch(
      { mode: "game", metadata: { activeAgentIds: ["hierarchical-maps"] } },
      true,
    ),
    null,
    "The correction must preserve Maps when spatial snapshots exist",
  );
  assert.equal(
    buildHierarchicalMapsSelectionCorrectionPatch(
      { mode: "conversation", metadata: { activeAgentIds: ["hierarchical-maps"] } },
      false,
    ),
    null,
    "The correction must not alter chat modes that the faulty migration did not touch",
  );

  const migrationSteps: string[] = [];
  const completedMigration = await migrateLegacyCapabilities({} as never, true, {
    async migrateAvailability() {
      migrationSteps.push("packages");
      return { migrated: true, legacy: true, complete: false };
    },
    async migrateChatSelections() {
      migrationSteps.push("chats");
    },
    async correctHierarchicalMapsSelections() {
      migrationSteps.push("correction");
      return 0;
    },
    async isHierarchicalMapsCorrectionComplete() {
      migrationSteps.push("correction-check");
      return false;
    },
    async flush() {
      migrationSteps.push("flush");
    },
    async completeHierarchicalMapsCorrection() {
      migrationSteps.push("correction-marker");
    },
    async complete() {
      migrationSteps.push("marker");
    },
  });
  assert.deepEqual(migrationSteps, ["packages", "correction-check", "chats", "flush", "correction-marker", "marker"]);
  assert.equal(completedMigration.complete, true);

  const interruptedSteps: string[] = [];
  await assert.rejects(
    migrateLegacyCapabilities({} as never, true, {
      async migrateAvailability() {
        interruptedSteps.push("packages");
        return { migrated: true, legacy: true, complete: false };
      },
      async migrateChatSelections() {
        interruptedSteps.push("chats");
      },
      async correctHierarchicalMapsSelections() {
        interruptedSteps.push("correction");
        return 0;
      },
      async isHierarchicalMapsCorrectionComplete() {
        interruptedSteps.push("correction-check");
        return false;
      },
      async flush() {
        interruptedSteps.push("flush");
        throw new Error("fixture flush failed");
      },
      async completeHierarchicalMapsCorrection() {
        interruptedSteps.push("correction-marker");
      },
      async complete() {
        interruptedSteps.push("marker");
      },
    }),
    /fixture flush failed/,
  );
  assert.deepEqual(interruptedSteps, ["packages", "correction-check", "chats", "flush"]);

  const correctionSteps: string[] = [];
  await migrateLegacyCapabilities({} as never, true, {
    async migrateAvailability() {
      correctionSteps.push("packages");
      return { migrated: false, legacy: true, complete: true };
    },
    async migrateChatSelections() {
      correctionSteps.push("chats");
    },
    async correctHierarchicalMapsSelections() {
      correctionSteps.push("correction");
      return 1;
    },
    async isHierarchicalMapsCorrectionComplete() {
      correctionSteps.push("correction-check");
      return false;
    },
    async flush() {
      correctionSteps.push("flush");
    },
    async completeHierarchicalMapsCorrection() {
      correctionSteps.push("correction-marker");
    },
    async complete() {
      correctionSteps.push("marker");
    },
  });
  assert.deepEqual(correctionSteps, ["packages", "correction-check", "correction", "flush", "correction-marker"]);

  assert.equal(existsSync(migrationPath), false);
  await capabilityPackageManager.completeLegacyAvailabilityMigration();
  assert.equal(JSON.parse(readFileSync(migrationPath, "utf8")).kind, "legacy");
  assert.equal((await capabilityPackageManager.migrateLegacyAvailability(false)).legacy, true);
  assert.equal(existsSync(mapsCorrectionPath), false);
  writeFileSync(mapsCorrectionPath, "{corrupted-marker");
  assert.equal(
    await capabilityPackageManager.isHierarchicalMapsSelectionCorrectionComplete(),
    false,
    "A corrupted Maps correction marker must not suppress the corrective migration",
  );
  await capabilityPackageManager.completeHierarchicalMapsSelectionCorrection();
  assert.equal(await capabilityPackageManager.isHierarchicalMapsSelectionCorrectionComplete(), true);
  writeFileSync(
    mapsCorrectionPath,
    JSON.stringify({ schemaVersion: 2, completedAt: new Date().toISOString() }),
  );
  assert.equal(
    await capabilityPackageManager.isHierarchicalMapsSelectionCorrectionComplete(),
    false,
    "A Maps correction marker with an unsupported schema must not be accepted",
  );
  writeFileSync(migrationPath, "{corrupted-marker");
  const recoveredCorruptedMigration = await capabilityPackageManager.migrateLegacyAvailability(false);
  assert.deepEqual(
    recoveredCorruptedMigration,
    { migrated: false, legacy: false, complete: true },
    "A corrupted availability marker must be replaced instead of treated as complete",
  );
  writeFileSync(
    migrationPath,
    JSON.stringify({ schemaVersion: 2, kind: "legacy", completedAt: new Date().toISOString() }),
  );
  const freshMigration = await capabilityPackageManager.migrateLegacyAvailability(false);
  assert.deepEqual(freshMigration, { migrated: false, legacy: false, complete: true });
  assert.equal(JSON.parse(readFileSync(migrationPath, "utf8")).kind, "fresh");
  assert.equal(
    (await capabilityPackageManager.migrateLegacyAvailability(true)).legacy,
    false,
    "A fresh-install marker must not later be mistaken for the faulty legacy migration",
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
  for (const version of ["1.0.0", "1.0.3", "1.0.6"]) {
    const incompatibleMapsRuntime = installedCapabilityPackageSchema.parse({
      ...installedPackage("hierarchical-maps", ["agent", "spatial-context"]),
      version,
      manifest: {
        ...legacyManifest,
        id: "hierarchical-maps",
        name: "Hierarchical Maps",
        version,
      },
    });
    assert.match(
      capabilityPackageManager.runtimeBlockReason(incompatibleMapsRuntime) ?? "",
      /incompatible with file-native storage/,
      `Hierarchical Maps ${version} must be blocked before its database adapter can crash the Engine`,
    );
  }
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
      const methods = ["debug", "info", "warn", "error", "debugOverride"];
      if (!methods.every((method) => typeof api.runtime?.logger?.[method] === "function")) {
        throw new Error("Capability runtime logger is incomplete");
      }
      const debugAgentsEnabled = api.runtime.isDebugAgentsEnabled();
      if (typeof debugAgentsEnabled !== "boolean") throw new Error("Capability debug state is invalid");
      api.runtime.logger.debug("Capability package fixture activated");
      api.runtime.logger.debugOverride(false, "Capability package fixture debug override");
      if (typeof api.runtime.persistence?.transaction !== "function") {
        throw new Error("Capability persistence transaction is unavailable");
      }
      if (typeof api.runtime.persistence?.updateChatMetadata !== "function") {
        throw new Error("Capability chat metadata persistence is unavailable");
      }
      if (typeof api.runtime.persistence?.listExistingLorebookEntryIds !== "function") {
        throw new Error("Capability lore entry lookup is unavailable");
      }
      if (typeof api.runtime.resources?.listCharacters !== "function") {
        throw new Error("Capability character resources are unavailable");
      }
      if (typeof api.runtime.resources?.listEligibleLorebookEntries !== "function") {
        throw new Error("Capability lore resources are unavailable");
      }
      if (typeof api.runtime.languageModels?.resolve !== "function") {
        throw new Error("Capability language model host is unavailable");
      }
      if (typeof api.runtime.json?.parseJsonish !== "function") {
        throw new Error("Capability JSON parser is unavailable");
      }
      if (api.runtime.json.parseJsonish('Preface\\n{"ok":true}').ok !== true) {
        throw new Error("Capability JSON parser returned an invalid result");
      }
      await api.runtime.persistence.spatialSnapshots.listForChat("__marinara_capability_self_check__");
      await api.runtime.persistence.listExistingLorebookEntryIds([]);
      await api.runtime.resources.listCharacters([]);
      await api.runtime.resources.listEligibleLorebookEntries({ lorebookIds: [], entryIds: [] });
      api.registerService("readiness:success", { active: true, debugAgentsEnabled });
    }
    export async function selfCheck() {}`,
  );

  const { capabilityModuleRuntime, prepareCapabilityRuntimeEnvironment } =
    await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
  const configuredDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = "./data";
  prepareCapabilityRuntimeEnvironment(dataDir);
  assert.equal(
    process.env.DATA_DIR,
    dataDir,
    "Downloaded capability runtimes must replace relative DATA_DIR values with the host's resolved model directory",
  );
  if (configuredDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = configuredDataDir;
  const { getCapabilityService } =
    await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
  const { closeDB, getDB } = await import("../../packages/server/src/db/connection.js");
  closeDatabase = closeDB;
  const db = await getDB();
  const { createCapabilityPersistenceHost } =
    await import("../../packages/server/src/services/capability-packages/capability-persistence.service.js");
  const { createCapabilityResourceHost } =
    await import("../../packages/server/src/services/capability-packages/capability-resources.service.js");
  const persistence = createCapabilityPersistenceHost(db);
  const resources = createCapabilityResourceHost(db);
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
  const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
  const chatsStore = createChatsStorage(db);
  const autoAddedMapsChat = await chatsStore.create({
    name: "Auto-added Maps selection fixture",
    mode: "roleplay",
    characterIds: [],
  });
  assert.ok(autoAddedMapsChat);
  await chatsStore.patchMetadata(autoAddedMapsChat.id, {
    enableAgents: false,
    activeAgentIds: ["illustrator", "hierarchical-maps"],
  });
  const autoAddedBeforeCorrection = await chatsStore.getById(autoAddedMapsChat.id);
  assert.ok(autoAddedBeforeCorrection);

  const definitionMapsChat = await chatsStore.create({
    name: "Persisted Maps definition fixture",
    mode: "roleplay",
    characterIds: [],
  });
  assert.ok(definitionMapsChat);
  await chatsStore.patchMetadata(definitionMapsChat.id, {
    activeAgentIds: ["hierarchical-maps"],
    spatialContext: {
      schemaVersion: 1,
      ownerMode: "roleplay",
      enabled: true,
      locations: [
        {
          id: "existing-location",
          parentId: null,
          name: "Existing location",
          kind: "region",
          description: "A persisted map location.",
          lorebookEntryIds: [],
          childPresentation: "list",
          links: [],
          status: "active",
          sortOrder: 0,
        },
      ],
      startingLocationId: "existing-location",
      revision: 1,
    },
  });

  const snapshotMapsChat = await chatsStore.create({
    name: "Persisted Maps snapshot fixture",
    mode: "game",
    characterIds: [],
  });
  assert.ok(snapshotMapsChat);
  await chatsStore.patchMetadata(snapshotMapsChat.id, { activeAgentIds: ["hierarchical-maps"] });
  await persistence.spatialSnapshots.create({
    id: "maps-correction-snapshot",
    chatId: snapshotMapsChat.id,
    messageId: "",
    swipeIndex: 0,
    currentLocationId: "existing-location",
    definitionRevision: 1,
    source: "bootstrap",
    transitionCommandId: null,
    transitionPayloadHash: null,
    createdAt: "2026-07-16T00:00:00.000Z",
  });

  assert.equal(await correctLegacyHierarchicalMapsSelections(db), 1);
  const correctedMetadata = JSON.parse(String((await chatsStore.getById(autoAddedMapsChat.id))?.metadata));
  assert.deepEqual(correctedMetadata.activeAgentIds, ["illustrator"]);
  assert.equal(correctedMetadata.enableAgents, false);
  assert.equal((await chatsStore.getById(autoAddedMapsChat.id))?.updatedAt, autoAddedBeforeCorrection.updatedAt);
  assert.deepEqual(JSON.parse(String((await chatsStore.getById(definitionMapsChat.id))?.metadata)).activeAgentIds, [
    "hierarchical-maps",
  ]);
  assert.deepEqual(JSON.parse(String((await chatsStore.getById(snapshotMapsChat.id))?.metadata)).activeAgentIds, [
    "hierarchical-maps",
  ]);
  assert.equal(await correctLegacyHierarchicalMapsSelections(db), 0, "The chat correction must be idempotent");

  const rollbackChat = await chatsStore.create({
    name: "Capability persistence rollback fixture",
    mode: "roleplay",
    characterIds: [],
  });
  assert.ok(rollbackChat);
  const rollbackChatBefore = await persistence.getChat(rollbackChat.id);
  assert.ok(rollbackChatBefore);
  assert.equal(rollbackChatBefore.name, "Capability persistence rollback fixture");
  assert.deepEqual(rollbackChatBefore.characterIds, []);
  assert.equal(rollbackChatBefore.connectionId, null);
  const gameStates = createGameStateStorage(db);
  const gameStateBase = {
    chatId: rollbackChat.id,
    swipeIndex: 0,
    date: null,
    time: null,
    location: null,
    weather: null,
    temperature: null,
    worldCustomFields: [],
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    fieldLocks: null,
    hiddenTrackerFields: null,
    committed: true,
  };
  const firstGameStateId = await gameStates.create({
    ...gameStateBase,
    messageId: "game-state-order-first",
  });
  const firstGameState = await gameStates.getById(firstGameStateId);
  assert.ok(firstGameState);
  const secondGameStateId = await gameStates.create({
    ...gameStateBase,
    messageId: "game-state-order-second",
  });
  const secondGameState = await gameStates.getById(secondGameStateId);
  assert.ok(secondGameState);
  assert.ok(
    secondGameState.createdAt > firstGameState.createdAt,
    "Live Game snapshots must retain creation order when the clock has not advanced",
  );
  assert.equal((await gameStates.getLatest(rollbackChat.id))?.id, secondGameStateId);
  const lorebooks = createLorebooksStorage(db);
  const lorebook = await lorebooks.create({ name: "Capability persistence fixture" });
  assert.ok(lorebook);
  const lorebookEntry = await lorebooks.createEntry({
    lorebookId: lorebook.id,
    name: "Existing capability entry",
    content: "A stable lore entry used by the capability persistence regression.",
  });
  assert.ok(lorebookEntry);
  assert.deepEqual(
    await persistence.listExistingLorebookEntryIds([lorebookEntry.id, "missing-entry", lorebookEntry.id]),
    [lorebookEntry.id],
  );
  assert.deepEqual(await resources.listEligibleLorebookEntries({ lorebookIds: [lorebook.id], entryIds: [] }), [
    {
      id: lorebookEntry.id,
      lorebookId: lorebook.id,
      lorebookName: "Capability persistence fixture",
      name: "Existing capability entry",
      content: "A stable lore entry used by the capability persistence regression.",
      description: "",
    },
  ]);
  assert.deepEqual(
    await resources.listEligibleLorebookEntries({
      lorebookIds: [lorebook.id],
      entryIds: [lorebookEntry.id],
      excludedLorebookIds: [lorebook.id],
    }),
    [],
  );
  await persistence.spatialSnapshots.create({
    id: "rollback-original-snapshot",
    chatId: rollbackChat.id,
    messageId: "",
    swipeIndex: 0,
    currentLocationId: "original-location",
    definitionRevision: 1,
    source: "bootstrap",
    transitionCommandId: null,
    transitionPayloadHash: null,
    createdAt: "2026-07-16T00:00:00.000Z",
  });
  await assert.rejects(
    persistence.transaction(async (transaction) => {
      await transaction.updateChatMetadata({
        chatId: rollbackChat.id,
        metadata: { spatialContext: { revision: 2 } },
        updatedAt: "2026-07-16T00:01:00.000Z",
      });
      await transaction.spatialSnapshots.replaceBootstrap({
        id: "rollback-snapshot",
        chatId: rollbackChat.id,
        messageId: "",
        swipeIndex: 0,
        currentLocationId: "replacement-location",
        definitionRevision: 2,
        source: "bootstrap",
        transitionCommandId: null,
        transitionPayloadHash: null,
        createdAt: "2026-07-16T00:01:00.000Z",
      });
      throw new Error("rollback fixture");
    }),
    /rollback fixture/,
  );
  assert.equal(await persistence.spatialSnapshots.getById("rollback-snapshot"), null);
  assert.equal((await persistence.spatialSnapshots.getBootstrap(rollbackChat.id))?.id, "rollback-original-snapshot");
  assert.deepEqual((await persistence.getChat(rollbackChat.id))?.metadata, rollbackChatBefore.metadata);

  await persistence.spatialSnapshots.create({
    id: "standalone-snapshot-id-conflict",
    chatId: rollbackChat.id,
    messageId: "standalone-snapshot-anchor",
    swipeIndex: 0,
    currentLocationId: "anchored-location",
    definitionRevision: 1,
    source: "generation",
    transitionCommandId: null,
    transitionPayloadHash: null,
    createdAt: "2026-07-16T00:01:30.000Z",
  });
  await assert.rejects(
    persistence.spatialSnapshots.replaceBootstrap({
      id: "standalone-snapshot-id-conflict",
      chatId: rollbackChat.id,
      currentLocationId: "replacement-location",
      definitionRevision: 2,
      source: "bootstrap",
      transitionCommandId: null,
      transitionPayloadHash: null,
      createdAt: "2026-07-16T00:01:31.000Z",
    }),
  );
  assert.equal(
    (await persistence.spatialSnapshots.getBootstrap(rollbackChat.id))?.id,
    "rollback-original-snapshot",
    "A failed standalone snapshot replacement must preserve the previous bootstrap",
  );

  await persistence.createMessageWithSwipe({
    id: "atomic-existing-message",
    swipeId: "atomic-shared-swipe",
    chatId: rollbackChat.id,
    role: "user",
    characterId: null,
    content: "Existing atomic message",
    extra: {},
    createdAt: "2026-07-16T00:01:40.000Z",
  });
  await assert.rejects(
    persistence.createMessageWithSwipe({
      id: "atomic-orphan-candidate",
      swipeId: "atomic-shared-swipe",
      chatId: rollbackChat.id,
      role: "user",
      characterId: null,
      content: "This message must roll back when its swipe conflicts",
      extra: {},
      createdAt: "2026-07-16T00:01:41.000Z",
    }),
  );
  assert.equal(
    (await persistence.listMessages(rollbackChat.id)).some((message) => message.id === "atomic-orphan-candidate"),
    false,
    "A failed initial swipe insert must not leave an orphaned message",
  );

  await persistence.transaction(async (transaction) => {
    await transaction.updateChatMetadata({
      chatId: rollbackChat.id,
      metadata: { spatialContext: { revision: 2 } },
      updatedAt: "2026-07-16T00:02:00.000Z",
    });
    await transaction.spatialSnapshots.replaceBootstrap({
      id: "committed-definition-snapshot",
      chatId: rollbackChat.id,
      messageId: "",
      swipeIndex: 0,
      currentLocationId: "committed-location",
      definitionRevision: 2,
      source: "bootstrap",
      transitionCommandId: null,
      transitionPayloadHash: null,
      createdAt: "2026-07-16T00:02:00.000Z",
    });
  });
  assert.deepEqual(JSON.parse(String((await persistence.getChat(rollbackChat.id))?.metadata)), {
    spatialContext: { revision: 2 },
  });
  assert.equal((await persistence.spatialSnapshots.getBootstrap(rollbackChat.id))?.id, "committed-definition-snapshot");

  await capabilityModuleRuntime.start({ db } as Parameters<typeof capabilityModuleRuntime.start>[0]);

  const readinessById = new Map((await capabilityPackageManager.installed()).map((item) => [item.id, item]));
  assert.equal(readinessById.get("hierarchical-maps")?.status, "error");
  assert.equal(readinessById.get("hierarchical-maps")?.readiness, "error");
  assert.match(readinessById.get("hierarchical-maps")?.readinessError ?? "", /incompatible with file-native storage/);
  assert.equal(readinessById.get("readiness-failure")?.readiness, "error");
  assert.match(readinessById.get("readiness-failure")?.readinessError ?? "", /fixture snapshot read failed/);
  assert.equal(readinessById.get("readiness-success")?.status, "active");
  assert.equal(readinessById.get("readiness-success")?.readiness, "ready");

  assert.equal(getCapabilityService("readiness:failure"), null, "Failed self-check contributions must be removed");
  assert.equal(
    getCapabilityService<{ active: boolean; debugAgentsEnabled: boolean }>("readiness:success")?.active,
    true,
  );
  assert.equal(
    typeof getCapabilityService<{ active: boolean; debugAgentsEnabled: boolean }>("readiness:success")
      ?.debugAgentsEnabled,
    "boolean",
  );
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
  assert.equal(
    JSON.stringify(diagnostics).includes("snapshot read failed"),
    false,
    "Health diagnostics must omit errors",
  );

  await capabilityModuleRuntime.stop();
  assert.equal(getCapabilityService("readiness:success"), null, "Runtime stop must remove ready contributions");
  const hotGame = installedPackage("hot-game", ["agent", "turn-game"], "1.0.0", true);
  writeRegistry([hotGame]);
  mkdirSync(join(packagesRoot, "versions", hotGame.id, hotGame.version), { recursive: true });
  writeFileSync(
    join(packagesRoot, "versions", hotGame.id, hotGame.version, "server.mjs"),
    `export async function activate({ api }) {
      return api.registerService("hot-game:runtime", { active: true });
    }`,
  );
  const activatedHotGame = await capabilityModuleRuntime.activatePackage(
    {} as Parameters<typeof capabilityModuleRuntime.activatePackage>[0],
    hotGame.id,
  );
  assert.equal(activatedHotGame.status, "active");
  assert.equal(activatedHotGame.readiness, "ready");
  assert.deepEqual(getCapabilityService("hot-game:runtime"), { active: true });
  await capabilityModuleRuntime.deactivatePackage(hotGame.id);
  assert.equal(getCapabilityService("hot-game:runtime"), null, "Hot uninstall must remove game contributions");

  const { getFileTableConfig, isFileTable } = await import("../../packages/server/src/db/file-schema.js");
  const packageTable = {};
  Object.defineProperty(packageTable, Symbol.for("marinara:file-table"), {
    value: { name: "package_fixture", columns: {}, uniqueConstraints: [] },
  });
  assert.equal(isFileTable(packageTable), true, "Package-bundled file tables must share the host table identity");
  assert.equal(getFileTableConfig(packageTable as never).name, "package_fixture");

  await capabilityModuleRuntime.stop();

  console.info("Capability package lifecycle and readiness regressions passed.");
} finally {
  await closeDatabase?.();
  rmSync(dataDir, { recursive: true, force: true });
}
