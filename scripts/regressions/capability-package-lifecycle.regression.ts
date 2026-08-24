import assert from "node:assert/strict";
import crypto, { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = mkdtempSync(join(tmpdir(), "marinara-capability-lifecycle-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_GIT_BRANCH = "staging";

const packagesRoot = join(dataDir, "capability-packages");
const registryPath = join(packagesRoot, "installed.json");
const migrationPath = join(packagesRoot, "availability-migration-v1.json");
const noodleMigrationPath = join(packagesRoot, "noodle-extraction-migration-v1.json");
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

function refreshRegistryFileIntegrity() {
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
    schemaVersion: number;
    packages: Array<ReturnType<typeof installedPackage>>;
  };
  for (const item of registry.packages) {
    const versionRoot = join(packagesRoot, "versions", item.id, item.version);
    for (const declaration of item.manifest.files) {
      const path = join(versionRoot, declaration.path);
      if (!existsSync(path)) continue;
      const data = readFileSync(path);
      declaration.bytes = data.byteLength;
      declaration.sha256 = createHash("sha256").update(data).digest("hex");
    }
  }
  writeFileSync(registryPath, JSON.stringify(registry, null, 2));
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
    parseCapabilityCatalogWithCompat,
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
  assert.deepEqual(supportedCapabilityApi, { major: 1, minor: 14 });

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
    capabilityApi: { major: 1, minor: 4 },
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
    /requires capability API 2\.0; this Engine supports 1\.14/,
  );
  const currentMinorManifest = capabilityPackageManifestSchema.parse({
    ...manifestV2,
    capabilityApi: { major: 1, minor: 14 },
  });
  assert.equal(getCapabilityApiCompatibilityIssue(currentMinorManifest), null);
  const unsupportedMinorManifest = capabilityPackageManifestSchema.parse({
    ...manifestV2,
    capabilityApi: { major: 1, minor: 15 },
  });
  assert.match(
    getCapabilityApiCompatibilityIssue(unsupportedMinorManifest) ?? "",
    /requires capability API 1\.15; this Engine supports 1\.14/,
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
          capabilityApi: { major: 1, minor: 4 },
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

  // A catalog entry built for a NEWER Engine (unknown manifest key under this
  // Engine's strict schemas) must be dropped per-entry, never fail the whole
  // document — all-or-nothing parsing bricked browsing/install/updates for
  // every package at once (#5091 review finding).
  const mixedGenerationCatalog = parseCapabilityCatalogWithCompat({
    schemaVersion: 1,
    generatedAt: "2026-08-15T00:00:00.000Z",
    packages: [
      forwardCompatibleCatalog.packages[0],
      {
        manifest: {
          ...manifestV2,
          id: "from-the-future",
          contributions: { slots: ["chat-settings"], holograms: { enabled: true } },
        },
        category: "misc",
        artifact: { url: "https://example.com/from-the-future.zip", sha256: "2".repeat(64), bytes: 1 },
      },
    ],
  });
  assert.equal(mixedGenerationCatalog.droppedEntries, 1, "the unparseable entry must be dropped, not fatal");
  assert.deepEqual(
    mixedGenerationCatalog.droppedIds,
    ["from-the-future"],
    "dropped entries must be identified by manifest id so operators can name what vanished",
  );
  assert.equal(mixedGenerationCatalog.catalog.packages.length, 1);
  assert.equal(mixedGenerationCatalog.catalog.packages[0]?.manifest.id, "hierarchical-maps");

  writeRegistry([installedPackage("conversation-calls", ["agent", "conversation-calls"])]);
  seedWhisperModels();

  const {
    capabilityPackageManager,
    findCompatibleCapabilityPackageUpdates,
    findPendingCapabilityPackageUpdates,
    getCapabilityAgentDetailDefinitionIssue,
    getCapabilityPackageArtifactSourceIssue,
    getCapabilityPackageInstallIssue,
    resolveOfficialAgentBranch,
    resolveCapabilityCatalogUrl,
    resolveCapabilityPackageArtifactUrl,
    resolveCapabilityPackageIconUrl,
    validatePackageArchiveEntries,
  } = await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  const directoryFloodArchive = {
    getEntries: () => Array.from({ length: 8_193 }, (_, index) => ({ isDirectory: true, entryName: `dir-${index}/` })),
  } as unknown as Parameters<typeof validatePackageArchiveEntries>[0];
  assert.throws(
    () => validatePackageArchiveEntries(directoryFloodArchive),
    /Package contains too many files/u,
    "directory-only ZIP entries count toward the archive entry limit",
  );
  // Case-insensitive duplicate guard (#5091): NTFS/APFS extract `Tiles.PNG`
  // onto `tiles.png`, leaving one on-disk file behind two declared hashes, so
  // an artifact carrying both casings is rejected before extraction. (The
  // manifest-level case-folded guard sits BEHIND this one in the live install
  // flow — a zip cannot reach it with a case collision the entry guard missed.)
  const { createRequire } = await import("node:module");
  const serverRequire = createRequire(new URL("../../packages/server/src/app.ts", import.meta.url));
  const AdmZipCtor = serverRequire("adm-zip") as new () => {
    addFile: (name: string, data: Buffer) => void;
  };
  const collisionZip = new AdmZipCtor();
  collisionZip.addFile("art/tiles.png", Buffer.from("first casing"));
  collisionZip.addFile("art/Tiles.PNG", Buffer.from("second casing"));
  assert.throws(
    () => validatePackageArchiveEntries(collisionZip as never),
    /duplicate file/u,
    "case-only filename collisions must be rejected at archive validation",
  );
  assert.equal(
    resolveCapabilityCatalogUrl("2.3.1", "", "main"),
    "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/catalog/v2/catalog.json",
  );
  assert.equal(
    resolveCapabilityCatalogUrl("3.2.2-beta.1", "", "main"),
    "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/catalog/v3/catalog.json",
  );
  assert.equal(
    resolveCapabilityCatalogUrl("development", "", "main"),
    "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/catalog/catalog.json",
    "Non-release builds must fall back to the legacy catalog instead of requesting a nonexistent lane",
  );
  assert.equal(
    resolveCapabilityCatalogUrl("2.3.1", "", "staging"),
    "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/staging/catalog/v2/catalog.json",
    "Engine staging must read the matching versioned Agent catalog from Marinara-Agents staging",
  );
  assert.equal(resolveOfficialAgentBranch("staging"), "staging");
  assert.equal(resolveOfficialAgentBranch("release/v2.4.0"), "staging");
  assert.equal(resolveOfficialAgentBranch("main"), "main");
  assert.equal(
    resolveOfficialAgentBranch("v2.4.2"),
    "main",
    "Tagged container builds must use the released Agent catalog",
  );
  assert.equal(
    resolveOfficialAgentBranch("refs/tags/v2.4.2"),
    "main",
    "Full Git tag refs must use the released Agent catalog",
  );
  assert.equal(resolveOfficialAgentBranch("v2.4.2-rc.1+build.01"), "main");
  for (const invalidReleaseRef of ["v02.004.000", "v2.4.2-01", "v2.4.2-alpha.01"]) {
    assert.equal(
      resolveOfficialAgentBranch(invalidReleaseRef),
      "staging",
      `${invalidReleaseRef} must not be treated as a canonical release tag`,
    );
  }
  const adversarialReleaseRef = `v0.0.0-0.${"--.".repeat(100_000)}!`;
  const releaseRefStartedAt = performance.now();
  assert.equal(resolveOfficialAgentBranch(adversarialReleaseRef), "staging");
  assert.ok(performance.now() - releaseRefStartedAt < 1_000, "Malformed release-tag classification must stay linear");
  assert.equal(
    resolveOfficialAgentBranch("feature/catalog-ui"),
    "staging",
    "Feature branches must follow the staging Agent catalog so extracted packages can be reviewed before release",
  );
  assert.equal(resolveOfficialAgentBranch("hotfix/noodle-recovery"), "main");
  assert.equal(resolveOfficialAgentBranch(null), "main");
  assert.equal(getCapabilityPackageInstallIssue(legacyManifest), null);

  const brandedHomeTabManifest = capabilityPackageManifestSchema.parse({
    ...legacyManifest,
    id: "branded-home-tab",
    name: "Branded Home Tab",
    contributions: {
      slots: ["home-browser-tab"],
      homeBrowserTab: {
        label: "Branded",
        ariaLabel: "Open branded Home destination",
        iconPaths: ["brand-primary.png", "brand-secondary.png"],
      },
    },
    files: [
      ...legacyManifest.files,
      { path: "brand-primary.png", sha256: "1".repeat(64), bytes: 1 },
      { path: "brand-secondary.png", sha256: "2".repeat(64), bytes: 1 },
    ],
  });
  assert.deepEqual(brandedHomeTabManifest.contributions?.homeBrowserTab?.iconPaths, [
    "brand-primary.png",
    "brand-secondary.png",
  ]);
  assert.throws(
    () =>
      capabilityPackageManifestSchema.parse({
        ...brandedHomeTabManifest,
        contributions: {
          ...brandedHomeTabManifest.contributions,
          homeBrowserTab: {
            ...brandedHomeTabManifest.contributions?.homeBrowserTab,
            iconPaths: ["undeclared.png"],
          },
        },
      }),
    /must be declared in the package file manifest/u,
    "Home tab artwork cannot escape the package's verified file manifest",
  );
  const agentDetailFixture = {
    name: "Agent detail fixture",
    description: "Capability lifecycle regression fixture.",
    author: "Marinara",
    phase: "post_processing" as const,
    enabledByDefault: false,
    category: "misc" as const,
    defaultPromptTemplate: "Return a result.",
  };
  assert.equal(
    getCapabilityAgentDetailDefinitionIssue("storyboard", [
      { ...agentDetailFixture, id: "storyboard", execution: "host" },
    ]),
    null,
    "Host-orchestrated agents may own package detail settings",
  );
  assert.match(
    getCapabilityAgentDetailDefinitionIssue("pipeline-agent", [
      { ...agentDetailFixture, id: "pipeline-agent", execution: "pipeline" },
    ]) ?? "",
    /feature or host agent/,
    "Generic pipeline agents must not claim package detail contributions",
  );

  const routeManifestWithoutRestart = capabilityPackageManifestSchema.parse({
    ...legacyManifest,
    id: "hot-route-package",
    name: "Hot Route Package",
    permissions: ["routes"],
    restartRequired: false,
  });
  assert.match(
    getCapabilityPackageInstallIssue(routeManifestWithoutRestart) ?? "",
    /privileged routes must require a restart/u,
    "Packages that add Fastify routes must not claim they can activate after startup",
  );

  const { createCapabilityEmbeddingHost, createConfiguredCapabilityEmbeddingHost } =
    await import("../../packages/server/src/services/capability-packages/capability-embedding.service.js");
  const embeddingHost = createCapabilityEmbeddingHost();
  assert.match(embeddingHost.spaceId, /^local:/u);
  assert.equal(
    await embeddingHost.embed(["x".repeat(100_001), "y".repeat(100_000)]),
    null,
    "Capability embeddings must bound aggregate input size",
  );

  const { registerCapabilityPrivilegedRoutes } =
    await import("../../packages/server/src/services/capability-packages/capability-route-registration.service.js");
  let registeredRoutes = 0;
  const routeServer = { listening: false };
  const routeApp = {
    server: routeServer,
    hasRoute: () => false,
    route: () => {
      registeredRoutes++;
    },
  } as Parameters<typeof registerCapabilityPrivilegedRoutes>[0];
  const routePackage = installedPackage("long-term-memory", ["agent"]);
  routePackage.manifest.permissions = ["routes"];
  await assert.rejects(
    registerCapabilityPrivilegedRoutes(
      routeApp,
      routePackage as Parameters<typeof registerCapabilityPrivilegedRoutes>[1],
      async (routes) => routes.get("/status", async () => ({ ok: true })),
      { prefix: "/api/another-package" },
    ),
    /must be under \/api\/long-term-memory/u,
  );
  await assert.rejects(
    registerCapabilityPrivilegedRoutes(
      routeApp,
      routePackage as Parameters<typeof registerCapabilityPrivilegedRoutes>[1],
      async (routes) => {
        routes.get("/status", async () => ({ ok: true }));
        routes.get("status", async () => ({ ok: true }));
      },
      { prefix: "/api/long-term-memory" },
    ),
    /duplicate route GET \/api\/long-term-memory\/status/u,
  );
  assert.equal(registeredRoutes, 0, "Invalid capability routes must not mutate Fastify");
  const deactivateInitialRoutes = await registerCapabilityPrivilegedRoutes(
    routeApp,
    routePackage as Parameters<typeof registerCapabilityPrivilegedRoutes>[1],
    async (routes) => routes.get("/status", async () => ({ version: 1 })),
    { prefix: "/api/long-term-memory" },
  );
  assert.equal(registeredRoutes, 1, "Capability routes must register normally before Fastify starts");
  const rootRouteApp = {
    server: { listening: false },
    hasRoute: () => false,
    route: (definition: { url: string }) => assert.equal(definition.url, "/api/root-package"),
  } as Parameters<typeof registerCapabilityPrivilegedRoutes>[0];
  const rootRoutePackage = installedPackage("root-package", ["agent"]);
  rootRoutePackage.manifest.permissions = ["routes"];
  await registerCapabilityPrivilegedRoutes(
    rootRouteApp,
    rootRoutePackage as Parameters<typeof registerCapabilityPrivilegedRoutes>[1],
    async (routes) => routes.get("/", async () => ({ ok: true })),
    { prefix: "/api/root-package" },
  );
  routeServer.listening = true;
  const deactivateReactivatedRoutes = await registerCapabilityPrivilegedRoutes(
    routeApp,
    routePackage as Parameters<typeof registerCapabilityPrivilegedRoutes>[1],
    async (routes) => routes.get("/status", async () => ({ version: 2 })),
    { prefix: "/api/long-term-memory" },
  );
  assert.equal(registeredRoutes, 1, "Existing route slots must reactivate without mutating a listening Fastify app");
  await assert.rejects(
    registerCapabilityPrivilegedRoutes(
      routeApp,
      routePackage as Parameters<typeof registerCapabilityPrivilegedRoutes>[1],
      async (routes) => routes.get("/new-status", async () => ({ ok: true })),
      { prefix: "/api/long-term-memory" },
    ),
    /must be restarted before new privileged routes can be activated/u,
  );
  assert.equal(registeredRoutes, 1, "Post-start activation must not register a previously unseen Fastify route");
  deactivateReactivatedRoutes();
  deactivateInitialRoutes();

  const { withLongTermMemoryRuntimeTimeout } =
    await import("../../packages/server/src/services/generation/long-term-memory-runtime.js");
  const timeoutStartedAt = Date.now();
  await assert.rejects(
    withLongTermMemoryRuntimeTimeout(20, async () => new Promise<never>(() => {})),
    /timed out after 20 ms/u,
  );
  assert.ok(Date.now() - timeoutStartedAt < 1_000, "Long-term memory capability calls must have a total-duration cap");

  const capabilityLanguageModelSource = readFileSync(
    join(repositoryRoot, "packages/server/src/services/capability-packages/capability-language-model.service.ts"),
    "utf8",
  );
  assert.match(
    capabilityLanguageModelSource,
    /reasoningEffort:\s*options\.reasoningEffort,/u,
    "Capability model calls must preserve an explicit reasoning effort of none",
  );
  assert.doesNotMatch(
    capabilityLanguageModelSource,
    /options\.reasoningEffort\s*===\s*"none"\s*\?\s*undefined/u,
    "Capability model calls must not discard an explicit reasoning disable request",
  );

  const chatSettingsSource = readFileSync(
    join(repositoryRoot, "packages/client/src/components/chat/ChatSettingsDrawer.tsx"),
    "utf8",
  );
  assert.match(
    chatSettingsSource,
    /gameAgentPool\.map\(\(agent\)[\s\S]{0,7000}agent\.id === "long-term-memory" && ltmPackage[\s\S]{0,2500}<CapabilityElement/u,
    "Game chat settings must render the Long-Term Memory package controls",
  );
  assert.match(
    chatSettingsSource,
    /callsPackage \?\s[\s\S]{0,2200}ltmPackage \?\s[\s\S]{0,1800}setLtmEnabledForChat/u,
    "Conversation chat settings must place Long-Term Memory below Calls with its activation control",
  );
  assert.match(
    chatSettingsSource,
    /const setLtmEnabledForChat = useCallback\([\s\S]{0,900}activeAgentIds: enabled[\s\S]{0,300}filter\(\(id\) => id !== ltmPackageId\)/u,
    "Long-Term Memory activation must preserve other active agents while toggling its own ID",
  );
  const serverlessTurnGameManifest = capabilityPackageManifestSchema.parse({
    ...legacyManifest,
    id: "serverless-turn-game",
    name: "Serverless Turn Game",
    kind: ["agent", "turn-game"],
    entrypoints: { client: "client.js" },
    files: [{ path: "client.js", sha256: "0".repeat(64), bytes: 1 }],
  });
  assert.match(
    getCapabilityPackageInstallIssue(serverlessTurnGameManifest) ?? "",
    /require a server entrypoint/,
    "Turn-game packages must fail validation before installation mutates package state",
  );
  assert.equal(
    resolveCapabilityCatalogUrl("3.2.2", " https://catalog.example.test/custom.json "),
    "https://catalog.example.test/custom.json",
    "An operator catalog override must remain exact and take precedence over Engine lane selection",
  );
  const canonicalArtifactEntry = {
    manifest: legacyManifest,
    category: "misc" as const,
    artifact: {
      url: "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/legacy-1.0.0.zip",
      sha256: "1".repeat(64),
      bytes: 1,
    },
    iconUrl: "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artwork/agent-covers/legacy.png",
  };
  const officialCatalogUrl = resolveCapabilityCatalogUrl("development", "", "main");
  const stagingCatalogUrl = resolveCapabilityCatalogUrl("development", "", "staging");
  const activeCatalogUrl = resolveCapabilityCatalogUrl();
  let requestedCatalogUrl: string | URL | undefined;
  // The explicit null preview URL keeps this block pinning the PUBLISHED catalog
  // selection: run from a `staging` checkout the preview overlay fetch would
  // otherwise land second and overwrite requestedCatalogUrl. Overlay behaviour
  // has its own coverage in capability-preview-overlay.regression.ts.
  const normalizedCatalog = await capabilityPackageManager.catalog(async (url) => {
    requestedCatalogUrl = url;
    return new Response(
      JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-08-01T00:00:00.000Z",
        packages: [canonicalArtifactEntry],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }, null);
  assert.equal(
    requestedCatalogUrl,
    activeCatalogUrl,
    "The package manager must request the catalog URL selected for the current Engine channel",
  );
  assert.equal(
    normalizedCatalog.packages[0]?.iconUrl,
    "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/staging/artwork/agent-covers/legacy.png",
    "The catalog response must expose artwork normalized through the active catalog URL",
  );
  assert.equal(getCapabilityPackageArtifactSourceIssue(canonicalArtifactEntry, officialCatalogUrl), null);
  assert.equal(
    getCapabilityPackageArtifactSourceIssue(canonicalArtifactEntry, stagingCatalogUrl),
    null,
    "Staging catalogs may retain canonical main URLs in their generated metadata",
  );
  assert.equal(
    resolveCapabilityPackageArtifactUrl(canonicalArtifactEntry, stagingCatalogUrl),
    "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/staging/artifacts/legacy-1.0.0.zip",
    "Engine staging must download official artifacts from Marinara-Agents staging even when generated metadata remains stable",
  );
  assert.equal(
    resolveCapabilityPackageIconUrl(canonicalArtifactEntry, stagingCatalogUrl),
    "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/staging/artwork/agent-covers/legacy.png",
    "Engine staging must load official artwork from Marinara-Agents staging even when generated metadata remains stable",
  );
  assert.match(
    getCapabilityPackageArtifactSourceIssue(
      {
        ...canonicalArtifactEntry,
        artifact: { ...canonicalArtifactEntry.artifact, url: "https://attacker.example/legacy-1.0.0.zip" },
      },
      officialCatalogUrl,
    ) ?? "",
    /canonical Marinara-Agents artifact URL/,
    "The official catalog must not redirect executable packages to another host, regardless of any locally configured MARINARA_AGENT_CATALOG_URL",
  );
  assert.equal(
    getCapabilityPackageArtifactSourceIssue(
      {
        ...canonicalArtifactEntry,
        artifact: { ...canonicalArtifactEntry.artifact, url: "https://packages.example/legacy.zip" },
      },
      "https://catalog.example.test/custom.json",
    ),
    null,
    "Explicit custom catalog operators retain control of their artifact host",
  );
  assert.equal(
    resolveCapabilityPackageArtifactUrl(
      {
        ...canonicalArtifactEntry,
        artifact: { ...canonicalArtifactEntry.artifact, url: "https://packages.example/legacy.zip" },
      },
      "https://catalog.example.test/custom.json",
    ),
    "https://packages.example/legacy.zip",
    "Explicit custom catalogs must retain their configured artifact URLs",
  );
  assert.equal(
    resolveCapabilityPackageIconUrl(
      { ...canonicalArtifactEntry, iconUrl: "https://packages.example/legacy.png" },
      "https://catalog.example.test/custom.json",
    ),
    "https://packages.example/legacy.png",
    "Explicit custom catalogs must retain their configured artwork URLs",
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
  writeFileSync(mapsCorrectionPath, JSON.stringify({ schemaVersion: 2, completedAt: new Date().toISOString() }));
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

  rmSync(noodleMigrationPath, { force: true });
  writeRegistry([]);
  assert.deepEqual(
    await capabilityPackageManager.migrateExtractedNoodleAvailability(false),
    { migrated: false, legacy: false },
    "Fresh profiles must not receive the optional Noodle package",
  );
  assert.equal(JSON.parse(readFileSync(noodleMigrationPath, "utf8")).kind, "fresh");
  assert.deepEqual(
    await capabilityPackageManager.migrateExtractedNoodleAvailability(true),
    { migrated: false, legacy: false },
    "A completed fresh-profile marker must not later auto-install Noodle",
  );

  rmSync(noodleMigrationPath, { force: true });
  writeRegistry([installedPackage("noodle", ["agent"])]);
  assert.deepEqual(
    await capabilityPackageManager.migrateExtractedNoodleAvailability(true),
    { migrated: false, legacy: true },
    "Upgraded profiles with Noodle already installed must record legacy availability without downloading again",
  );
  assert.equal(JSON.parse(readFileSync(noodleMigrationPath, "utf8")).kind, "legacy");
  await capabilityPackageManager.uninstall("noodle");
  assert.deepEqual(
    await capabilityPackageManager.migrateExtractedNoodleAvailability(true),
    { migrated: false, legacy: true },
    "Explicit Noodle removal must survive later startups instead of being mistaken for an interrupted migration",
  );

  rmSync(noodleMigrationPath, { force: true });
  writeRegistry([]);
  const originalCatalog = capabilityPackageManager.catalog;
  capabilityPackageManager.catalog = async () => ({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    packages: [],
  });
  try {
    assert.deepEqual(
      await capabilityPackageManager.migrateExtractedNoodleAvailability(true),
      { migrated: false, legacy: true, pending: true },
      "A catalog publication gap must remain retryable without failing Engine startup",
    );
    assert.equal(
      existsSync(noodleMigrationPath),
      false,
      "A missing catalog entry must not prematurely complete the extraction migration",
    );
  } finally {
    capabilityPackageManager.catalog = originalCatalog;
  }
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
    "Update discovery must select only newer, compatible, downloadable packages already installed by the user",
  );
  assert.deepEqual(
    findPendingCapabilityPackageUpdates(
      updateCandidates.map(({ installed }) => installed),
      updateCatalog,
      { "conversation-calls": "1.0.2" },
      "2.3.1",
    ),
    [],
    "Declining an exact Agent version must suppress its prompt without changing the installed version",
  );
  assert.deepEqual(
    findPendingCapabilityPackageUpdates(
      updateCandidates.map(({ installed }) => installed),
      updateCatalog,
      {},
      "2.3.1",
    ),
    [
      {
        id: "conversation-calls",
        name: "conversation-calls",
        installedVersion: "1.0.0",
        version: "1.0.2",
        artifactSha256: "1".repeat(64),
        restartRequired: true,
      },
    ],
    "A compatible Agent update must remain available until the user applies or declines that version",
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
  const agentSuite = {
    ...installedPackage("agent-suite", ["agent"]),
    readiness: "ready" as const,
    manifest: {
      ...installedPackage("agent-suite", ["agent"]).manifest,
      entrypoints: { server: "server.mjs", client: "client.js", agents: "agents.json" },
      contributions: {
        slots: ["home-browser-tab"],
        homeBrowserTab: { label: "Agent Suite", iconPaths: ["suite-tab.png"] },
      },
      files: [
        ...installedPackage("agent-suite", ["agent"]).manifest.files,
        { path: "agents.json", sha256: "0".repeat(64), bytes: 1 },
        { path: "suite-tab.png", sha256: "0".repeat(64), bytes: 1 },
      ],
    },
  };
  writeRegistry([agentSuite]);
  writeFileSync(
    join(packagesRoot, "versions", agentSuite.id, agentSuite.version, "agents.json"),
    JSON.stringify([
      {
        id: "agent-suite",
        name: "Agent Suite",
        description: "Primary agent.",
        phase: "parallel",
        enabledByDefault: true,
        category: "misc",
        defaultPromptTemplate: "Primary prompt.",
      },
      {
        id: "suite-helper",
        name: "Suite Helper",
        description: "Secondary agent.",
        phase: "parallel",
        enabledByDefault: true,
        category: "misc",
        defaultPromptTemplate: "Helper prompt.",
      },
    ]),
  );
  writeFileSync(join(packagesRoot, "versions", agentSuite.id, agentSuite.version, "suite-tab.png"), "x");
  refreshRegistryFileIntegrity();
  const originalCreateHash = crypto.createHash;
  let assetHashCount = 0;
  Object.defineProperty(crypto, "createHash", {
    configurable: true,
    value: (...args: Parameters<typeof createHash>) => {
      assetHashCount += 1;
      return originalCreateHash(...args);
    },
  });
  syncBuiltinESMExports();
  try {
    const browserTabAsset = await capabilityPackageManager.packageAsset(agentSuite.id, "suite-tab.png");
    assert.equal(browserTabAsset?.contentType, "image/png");
    assert.equal(
      browserTabAsset?.file,
      join(packagesRoot, "versions", agentSuite.id, agentSuite.version, "suite-tab.png"),
    );
    assert.equal(
      browserTabAsset?.data?.toString("utf8"),
      "x",
      "Every serve must hand back the exact bytes it hashed",
    );
    const repeatAsset = await capabilityPackageManager.packageAsset(agentSuite.id, "suite-tab.png");
    assert.deepEqual(repeatAsset, browserTabAsset, "Repeated resolution must be deterministic");
    assert.equal(
      assetHashCount,
      2,
      "EVERY served body is hash-verified — a stat-only fast path could send bytes written after verification",
    );

    const changedRegistry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      packages: Array<ReturnType<typeof installedPackage>>;
    };
    const changedAssetDeclaration = changedRegistry.packages
      .find((item) => item.id === agentSuite.id)
      ?.manifest.files.find((item) => item.path === "suite-tab.png");
    assert.ok(changedAssetDeclaration);
    const originalAssetSha256 = changedAssetDeclaration.sha256;
    changedAssetDeclaration.sha256 = "0".repeat(64);
    writeFileSync(registryPath, JSON.stringify(changedRegistry, null, 2));
    await assert.rejects(
      capabilityPackageManager.packageAsset(agentSuite.id, "suite-tab.png"),
      /integrity verification/u,
      "Changed manifest integrity metadata must not reuse an older successful verification",
    );
    assert.equal(assetHashCount, 3, "Changed manifest integrity metadata must force a fresh integrity check");

    changedAssetDeclaration.sha256 = originalAssetSha256;
    writeFileSync(registryPath, JSON.stringify(changedRegistry, null, 2));
    assert.ok(await capabilityPackageManager.packageAsset(agentSuite.id, "suite-tab.png"));
    writeFileSync(join(packagesRoot, "versions", agentSuite.id, agentSuite.version, "suite-tab.png"), "y");
    await assert.rejects(
      capabilityPackageManager.packageAsset(agentSuite.id, "suite-tab.png"),
      /integrity verification/u,
      "Capability assets changed outside the reviewed package must not be served",
    );
    assert.equal(assetHashCount, 5, "Changed asset metadata must force a fresh integrity check");
  } finally {
    Object.defineProperty(crypto, "createHash", { configurable: true, value: originalCreateHash });
    syncBuiltinESMExports();
  }
  writeFileSync(join(packagesRoot, "versions", agentSuite.id, agentSuite.version, "suite-tab.png"), "x");
  refreshRegistryFileIntegrity();
  assert.equal(
    await capabilityPackageManager.packageAsset(agentSuite.id, "server.mjs"),
    null,
    "Package payloads not declared as tab artwork must not be exposed as public assets",
  );
  assert.equal(
    await capabilityPackageManager.packageAsset(agentSuite.id, "../installed.json"),
    null,
    "Home tab asset requests must retain package traversal protection",
  );
  assert.deepEqual(
    (await capabilityPackageManager.agentDefinitions()).map(({ id, packageId }) => ({ id, packageId })),
    [
      { id: "agent-suite", packageId: "agent-suite" },
      { id: "suite-helper", packageId: "agent-suite" },
    ],
    "Capability agent registry rows must expose their owning package for package-aware uninstall controls",
  );
  assert.deepEqual(await capabilityPackageManager.packageAgentIds(agentSuite.id), ["agent-suite", "suite-helper"]);
  const removedAgentSuite = await capabilityPackageManager.uninstall(agentSuite.id);
  assert.deepEqual(
    removedAgentSuite && removedAgentSuite.agentIds,
    ["agent-suite", "suite-helper"],
    "Uninstall must retain every package-owned agent ID before deleting its definition file",
  );
  const { buildCapabilityAgentCleanupPatch } =
    await import("../../packages/server/src/routes/capability-packages.routes.js");
  assert.deepEqual(
    buildCapabilityAgentCleanupPatch(
      {
        activeAgentIds: ["agent-suite", "suite-helper", "illustrator"],
        agentOverrides: { "suite-helper": true, illustrator: false },
        agentPromptTemplateIds: { "agent-suite": "default", "suite-helper": "helper", illustrator: "portrait" },
        knowledgeAgentSources: { "suite-helper": { sourceLorebookIds: ["book"] }, illustrator: {} },
      },
      ["agent-suite", "suite-helper"],
    ),
    {
      activeAgentIds: ["illustrator"],
      agentOverrides: { illustrator: false },
      agentPromptTemplateIds: { illustrator: "portrait" },
      knowledgeAgentSources: { illustrator: {} },
    },
  );
  writeRegistry([agentSuite]);
  assert.deepEqual(
    await capabilityPackageManager.packageAgentIds(agentSuite.id),
    ["agent-suite"],
    "Uninstall cleanup must retain a safe package-ID fallback when agent definitions are unavailable",
  );

  writeRegistry([installedPackage("conversation-calls", ["agent", "conversation-calls"])]);
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
  ready.manifest.files.push({ path: "runtime-dependency.mjs", sha256: "0".repeat(64), bytes: 1 });
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
      const dependency = await import("./runtime-dependency.mjs");
      if (dependency.value !== "verified") throw new Error("Capability dependency bytes changed after verification");
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
      if (typeof api.runtime.getAgentConfig !== "function") {
        throw new Error("Capability API 1.5 agent config host is unavailable");
      }
      if (typeof api.runtime.embeddings?.embed !== "function" || !api.runtime.embeddings.spaceId) {
        throw new Error("Capability embedding host is unavailable");
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
    export async function selfCheck({ api }) {
      const dependency = await import("./runtime-dependency.mjs");
      const ownSource = await (await import("node:fs/promises")).readFile(new URL(import.meta.url), "utf8");
      if (dependency.value !== "verified" || !ownSource.includes("runtime-dependency.mjs")) {
        throw new Error("Capability snapshot did not retain verified runtime files");
      }
      api.registerService("readiness:late-import", { active: true });
    }`,
  );
  writeFileSync(
    join(packagesRoot, "versions", ready.id, ready.version, "runtime-dependency.mjs"),
    `export const value = "verified";`,
  );

  const { capabilityModuleRuntime, prepareCapabilityRuntimeEnvironment } =
    await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
  const configuredDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = "./data";
  prepareCapabilityRuntimeEnvironment(dataDir);
  process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
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
  const { createConnectionsStorage } =
    await import("../../packages/server/src/services/storage/connections.storage.js");
  const remoteEmbeddingConnection = await createConnectionsStorage(db).create({
    name: "Capability remote embeddings",
    provider: "custom",
    baseUrl: "https://chat.example.invalid/v1",
    embeddingBaseUrl: "https://embeddings.example.invalid/v1",
    embeddingModel: "text-embedding-regression",
  });
  const configuredEmbeddingHost = await createConfiguredCapabilityEmbeddingHost(db, remoteEmbeddingConnection.id);
  assert.equal(configuredEmbeddingHost.label, "Capability remote embeddings (text-embedding-regression)");
  assert.match(configuredEmbeddingHost.spaceId, /^remote:/u);
  const repeatedConfiguredEmbeddingHost = await createConfiguredCapabilityEmbeddingHost(
    db,
    remoteEmbeddingConnection.id,
  );
  assert.equal(
    configuredEmbeddingHost.spaceId,
    repeatedConfiguredEmbeddingHost.spaceId,
    "the same configured embedding source must keep a stable space ID",
  );
  const caseDistinctEmbeddingConnection = await createConnectionsStorage(db).create({
    name: "Capability case-distinct embeddings",
    provider: "custom",
    baseUrl: "https://chat.example.invalid/v1",
    embeddingBaseUrl: "https://embeddings.example.invalid/v1",
    embeddingModel: "Text-Embedding-Regression",
  });
  const caseDistinctEmbeddingHost = await createConfiguredCapabilityEmbeddingHost(
    db,
    caseDistinctEmbeddingConnection.id,
  );
  assert.notEqual(
    configuredEmbeddingHost.spaceId,
    caseDistinctEmbeddingHost.spaceId,
    "opaque embedding model IDs must retain case distinctions",
  );
  const { createCapabilityPersistenceHost } =
    await import("../../packages/server/src/services/capability-packages/capability-persistence.service.js");
  const { createCapabilityResourceHost } =
    await import("../../packages/server/src/services/capability-packages/capability-resources.service.js");
  const persistence = createCapabilityPersistenceHost(db);
  const resources = createCapabilityResourceHost(db);
  const createdDocument = await persistence.documents.create({
    id: "maps-template-document",
    packageId: "hierarchical-maps",
    kind: "map-template",
    name: "Test map",
    description: "Reusable map fixture",
    data: { locations: ["Town"] },
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
  });
  assert.equal(createdDocument.revision, 1);
  assert.deepEqual(createdDocument.data, { locations: ["Town"] });
  assert.equal((await persistence.documents.list("hierarchical-maps", "map-template")).length, 1);
  assert.equal(
    await persistence.documents.update({
      id: createdDocument.id,
      packageId: createdDocument.packageId,
      expectedRevision: 99,
      name: "Stale map",
      description: "",
      data: {},
      updatedAt: "2026-07-26T00:01:00.000Z",
    }),
    null,
    "Package documents must reject stale updates",
  );
  const updatedDocument = await persistence.documents.update({
    id: createdDocument.id,
    packageId: createdDocument.packageId,
    expectedRevision: createdDocument.revision,
    name: "Updated map",
    description: "Reusable map fixture",
    data: { locations: ["Town", "Castle"] },
    updatedAt: "2026-07-26T00:02:00.000Z",
  });
  assert.equal(updatedDocument?.revision, 2);
  assert.deepEqual(updatedDocument?.data, { locations: ["Town", "Castle"] });
  assert.equal(await persistence.documents.remove(createdDocument.packageId, createdDocument.id, 1), false);
  assert.equal(await persistence.documents.remove(createdDocument.packageId, createdDocument.id, 2), true);
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
  const namedBranchChat = await chatsStore.create({
    name: "Capability branch parent fallback",
    mode: "roleplay",
    characterIds: [],
  });
  assert.ok(namedBranchChat);
  await chatsStore.patchMetadata(namedBranchChat.id, {
    branchName: "NPC_First Kiss",
    branchParentChatId: rollbackChat.id,
  });
  const capabilityBranchChat = await persistence.getChat(namedBranchChat.id);
  assert.ok(capabilityBranchChat);
  assert.equal(capabilityBranchChat.name, "NPC_First Kiss");
  assert.equal(capabilityBranchChat.branch?.title, "NPC_First Kiss");
  assert.equal(capabilityBranchChat.branch?.parentChatId, rollbackChat.id);
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

  refreshRegistryFileIntegrity();
  const verifiedRuntimeFiles = capabilityPackageManager.verifiedRuntimeFiles.bind(capabilityPackageManager);
  let replacedVerifiedEntrypoint = false;
  capabilityPackageManager.verifiedRuntimeFiles = async (installed) => {
    const verified = await verifiedRuntimeFiles(installed);
    if (installed.id === "readiness-success") {
      writeFileSync(
        join(packagesRoot, "versions", installed.id, installed.version, "server.mjs"),
        `export async function activate({ api }) {
          api.registerService("readiness:tampered", { active: true });
        }`,
      );
      writeFileSync(
        join(packagesRoot, "versions", installed.id, installed.version, "runtime-dependency.mjs"),
        `export const value = "tampered";`,
      );
      replacedVerifiedEntrypoint = true;
    }
    return verified;
  };
  try {
    await capabilityModuleRuntime.start({ db } as Parameters<typeof capabilityModuleRuntime.start>[0]);
  } finally {
    capabilityPackageManager.verifiedRuntimeFiles = verifiedRuntimeFiles;
  }
  assert.equal(
    replacedVerifiedEntrypoint,
    true,
    "the runtime replacement regression reached the verification boundary",
  );
  assert.equal(
    getCapabilityService("readiness:tampered"),
    null,
    "runtime activation imports the verified bytes even if the installed entrypoint is replaced afterward",
  );
  assert.deepEqual(
    getCapabilityService("readiness:late-import"),
    { active: true },
    "late relative imports and import.meta.url reads remain available from the retained verified snapshot",
  );

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
  const runtimeSnapshotsRoot = join(dataDir, "capability-runtime-snapshots");
  assert.equal(
    existsSync(runtimeSnapshotsRoot) ? readdirSync(runtimeSnapshotsRoot).length : 0,
    0,
    "runtime snapshots are retained during activation and removed at stop",
  );
  const hotGame = installedPackage("hot-game", ["agent", "turn-game"], "1.0.0", true);
  writeRegistry([hotGame]);
  mkdirSync(join(packagesRoot, "versions", hotGame.id, hotGame.version), { recursive: true });
  writeFileSync(
    join(packagesRoot, "versions", hotGame.id, hotGame.version, "server.mjs"),
    `export async function activate({ api }) {
      return api.registerService("hot-game:runtime", { active: true });
    }`,
  );
  refreshRegistryFileIntegrity();
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
