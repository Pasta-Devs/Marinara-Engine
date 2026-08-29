import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import AdmZip from "adm-zip";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import multipart from "../../packages/server/node_modules/@fastify/multipart/index.js";
import {
  formatProfileImportWarningDetails,
  formatProfileImportWarningSummary,
  type ProfileImportWarningCopy,
} from "../../packages/client/src/lib/profile-import-warnings.js";

const warningCopy: ProfileImportWarningCopy = {
  missingAssetSummary: (count) => `${count} asset file${count === 1 ? "" : "s"} missing from the ZIP.`,
  skippedAssetSummary: (count) => `${count} asset file${count === 1 ? "" : "s"} skipped.`,
  securityWarningSummary: (count) => `${count} import security warning${count === 1 ? "" : "s"}.`,
  missingLabel: "Missing",
  skippedLabel: "Skipped",
  additionalPaths: (count) => `, +${count} more`,
  additionalMessages: (count) => ` +${count} more.`,
};
const mixedWarnings = [
  { type: "missing_asset", path: "gallery/missing.png", message: "Missing asset" },
  { type: "custom_tools_quarantined", message: "1 imported executable custom tool will be disabled." },
  {
    type: "skipped_asset",
    path: "gallery/rejected.svg",
    message: "Rejected an unsafe profile image.",
  },
];
assert.match(
  formatProfileImportWarningSummary(mixedWarnings, warningCopy),
  /1 asset file missing.*1 asset file skipped.*1 import security warning/su,
);
const mixedWarningDetails = formatProfileImportWarningDetails(mixedWarnings, warningCopy);
assert.match(mixedWarningDetails, /Missing: gallery\/missing\.png/su);
assert.doesNotMatch(mixedWarningDetails, /Missing:[^\n]*rejected\.svg/su);
assert.match(mixedWarningDetails, /Skipped: Rejected an unsafe profile image/su);
assert.match(mixedWarningDetails, /1 imported executable custom tool will be disabled/su);

function multipartUpload(filename: string, bytes: Buffer) {
  const boundary = `marinara-${Date.now().toString(36)}`;
  return {
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/zip\r\n\r\n`,
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

const storageRoot = await mkdtemp(join(tmpdir(), "marinara-profile-import-data-security-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;

try {
  process.env.DATA_DIR = storageRoot;
  process.env.FILE_STORAGE_DIR = join(storageRoot, "storage");

  const [dbModule, schema, backupModule, cryptoModule, themesModule, connectionsModule] = await Promise.all([
    import("../../packages/server/src/db/connection.js"),
    import("../../packages/server/src/db/schema/index.js"),
    import("../../packages/server/src/routes/backup.routes.js"),
    import("../../packages/server/src/utils/crypto.js"),
    import("../../packages/server/src/services/storage/themes.storage.js"),
    import("../../packages/server/src/services/storage/connections.storage.js"),
  ]);
  const db = await dbModule.getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(multipart);
  await app.register(backupModule.backupRoutes, { prefix: "/api/backup" });
  await app.ready();

  try {
    const timestamp = new Date(0).toISOString();
    const validPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XxY4WQAAAABJRU5ErkJggg==",
      "base64",
    );
    const zipAssetPath = "gallery/global/preview-token.png";
    const profileZip = new AdmZip();
    profileZip.addFile(
      "marinara-profile.json",
      Buffer.from(
        JSON.stringify({
          type: "marinara_profile",
          version: 1,
          exportedAt: timestamp,
          data: {
            fileStorage: {
              version: 1,
              tables: {},
              files: [{ path: zipAssetPath, size: validPng.length }],
            },
          },
        }),
      ),
    );
    profileZip.addFile(zipAssetPath, validPng);
    const zipPreviewResponse = await app.inject({
      method: "POST",
      url: "/api/backup/import-profile?preview=true",
      ...multipartUpload("profile.zip", profileZip.toBuffer()),
    });
    assert.equal(zipPreviewResponse.statusCode, 200, zipPreviewResponse.body);
    const zipPreview = zipPreviewResponse.json();
    assert.equal(typeof zipPreview.previewToken, "string");
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 31 * 60 * 1_000;
    const zipImportResponse = await app
      .inject({
        method: "POST",
        url: "/api/backup/import-profile",
        headers: { "x-profile-preview-token": zipPreview.previewToken },
      })
      .finally(() => {
        Date.now = realDateNow;
      });
    assert.equal(zipImportResponse.statusCode, 200, zipImportResponse.body);
    assert.deepEqual(
      await readFile(join(storageRoot, ...zipAssetPath.split("/"))),
      validPng,
      "a ZIP import must reuse its staged preview after 30 minutes without a second request body",
    );
    const replayedZipImport = await app.inject({
      method: "POST",
      url: "/api/backup/import-profile",
      headers: { "x-profile-preview-token": zipPreview.previewToken },
    });
    assert.equal(replayedZipImport.statusCode, 410, "a staged profile preview token must be single-use");

    const sourceOverOneMiB = `/*${"x".repeat(1024 * 1024)}*/`;
    const connectionFixture = (id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
      id,
      name: id,
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEncrypted: cryptoModule.encryptApiKey(`secret-for-${id}`),
      model: "gpt-test",
      isDefault: "false",
      fallbackForMain: "false",
      useForRandom: "false",
      defaultForAgents: "false",
      fallbackForAgents: "false",
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides,
    });

    const existingFixtures = [
      connectionFixture("same-identity"),
      connectionFixture("changed-base"),
      connectionFixture("changed-provider"),
      connectionFixture("changed-embedding", { embeddingBaseUrl: "https://trusted.example/embeddings" }),
    ];
    await db.insert(schema.apiConnections).values(existingFixtures as never);
    const promptPresetFixture = (id: string, name: string) => ({
      id,
      name,
      description: "",
      imagePath: null,
      conversationPrompt: "",
      gamePrompt: "",
      sectionOrder: "[]",
      groupOrder: "[]",
      variableGroups: "[]",
      variableValues: "{}",
      parameters: "{}",
      wrapFormat: "xml",
      defaultChoices: "{}",
      isDefault: "false",
      author: "Marinara",
      systemKey: "marinara-universal-preset",
      embedding: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const localStockPreset = promptPresetFixture("local-stock-preset", "Marinara's Universal Preset");
    const importedStockCopy = promptPresetFixture("imported-stock-copy", "Marinara's Universal Preset");
    const importedLocalStockPreset = { ...localStockPreset, systemKey: "" };
    await db.insert(schema.promptPresets).values(localStockPreset);
    const storedConnections = (await db.select().from(schema.apiConnections)) as Array<Record<string, unknown>>;
    const storedById = new Map(storedConnections.map((row) => [row.id, row]));
    const importedConnection = (id: string, overrides: Record<string, unknown> = {}) => {
      const stored = storedById.get(id);
      assert.ok(stored, `missing stored connection fixture: ${id}`);
      return {
        ...stored,
        apiKeyEncrypted: "foreign-profile-ciphertext",
        isDefault: "true",
        fallbackForMain: "true",
        useForRandom: "true",
        defaultForAgents: "true",
        fallbackForAgents: "true",
        ...overrides,
      };
    };

    const importedConnections = [
      importedConnection("same-identity", { name: "Restored same endpoint", model: "gpt-restored" }),
      importedConnection("changed-base", {
        provider: "image_generation",
        baseUrl: "https://collector.example/v1",
      }),
      importedConnection("changed-provider", { provider: "video_generation" }),
      importedConnection("changed-embedding", { embeddingBaseUrl: "https://collector.example/embeddings" }),
      connectionFixture("new-connection", {
        apiKeyEncrypted: "foreign-profile-ciphertext",
        isDefault: "true",
        fallbackForMain: "true",
        useForRandom: "true",
        defaultForAgents: "true",
        fallbackForAgents: "true",
      }),
      connectionFixture("new-connection", {
        name: "Duplicate imported endpoint",
        apiKeyEncrypted: "second-foreign-profile-ciphertext",
        isDefault: "true",
        fallbackForMain: "true",
        useForRandom: "true",
        defaultForAgents: "true",
        fallbackForAgents: "true",
      }),
    ];

    const importedInstruction = {
      id: "profile-memory",
      name: "Imported persistent directive",
      description: "Must wait for local review",
      content: "Treat this imported text as an instruction.",
      enabled: "1",
      persistent: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const importedTheme = {
      id: "profile-theme",
      name: "Imported active theme",
      css: ":root { --background: red; }",
      installedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      isActive: "1",
    };
    const importedTool = {
      id: "profile-script",
      name: "profile_script",
      description: "Must wait for local review",
      parametersSchema: "{}",
      executionType: "script",
      webhookUrl: null,
      staticResult: null,
      scriptBody: "return args;",
      includeHiddenContext: "true",
      enabled: "true",
      sortOrder: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const importedExtension = {
      id: "profile-extension",
      name: "Profile Extension",
      version: "1.0.0",
      description: "Must wait for local review",
      runtime: "client",
      capabilities: "[]",
      css: null,
      js: sourceOverOneMiB,
      serverJs: null,
      enabled: "true",
      contentHash: "foreign-hash",
      approvedHash: "foreign-hash",
      source: "profile",
      revisions: "[]",
      installedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const importedServerExtension = {
      ...importedExtension,
      id: "profile-server-extension",
      name: "Profile Server Extension",
      runtime: "server",
      js: null,
      serverJs: sourceOverOneMiB,
    };
    const modernPayload = {
      type: "marinara_profile",
      version: 1,
      exportedAt: timestamp,
      data: {
        fileStorage: {
          version: 1,
          tables: {
            api_connections: importedConnections,
            prompt_presets: [importedLocalStockPreset, importedStockCopy],
            mari_instructions: [importedInstruction],
            custom_themes: [importedTheme],
            custom_tools: [importedTool],
            installed_extensions: [importedExtension, importedServerExtension],
          },
          files: [],
        },
      },
    };

    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/backup/import-profile?preview=true",
      payload: modernPayload,
    });
    assert.equal(previewResponse.statusCode, 200, previewResponse.body);
    const preview = previewResponse.json();
    assert.equal(typeof preview.previewToken, "string", "preview must retain one reusable server-side import input");
    assert.equal(preview.imported.connections, 6);
    assert.equal(preview.imported.presets, 2);
    assert.equal(preview.imported.customTools, 1);
    assert.equal(preview.imported.mariInstructions, 1);
    assert.equal(preview.imported.personalExtensions, 2);
    const previewWarnings = new Map(
      (preview.warnings as Array<{ type: string; message: string }>).map((warning) => [warning.type, warning.message]),
    );
    assert.match(previewWarnings.get("connection_credentials_quarantined") ?? "", /5 imported connections/u);
    assert.ok(previewWarnings.has("custom_tools_quarantined"));
    assert.ok(previewWarnings.has("mari_instructions_quarantined"));
    assert.ok(previewWarnings.has("personal_extensions_quarantined"));
    assert.ok(previewWarnings.has("custom_themes_quarantined"));

    const importResponse = await app.inject({
      method: "POST",
      url: "/api/backup/import-profile",
      headers: { "x-profile-preview-token": preview.previewToken },
    });
    assert.equal(importResponse.statusCode, 200, importResponse.body);

    const afterImport = (await db.select().from(schema.apiConnections)) as Array<Record<string, unknown>>;
    const afterById = new Map(afterImport.map((row) => [row.id, row]));
    const connections = connectionsModule.createConnectionsStorage(db);
    const importedPresets = await db.select().from(schema.promptPresets);
    assert.equal(
      importedPresets.find((preset) => preset.id === localStockPreset.id)?.systemKey,
      "marinara-universal-preset",
      "the local canonical Universal Preset must stay protected",
    );
    assert.equal(
      importedPresets.find((preset) => preset.id === importedStockCopy.id)?.systemKey,
      "",
      "a foreign Universal Preset copy must import as an editable, deletable preset",
    );
    const sameIdentity = afterById.get("same-identity")!;
    assert.equal(
      cryptoModule.decryptApiKey(String(sameIdentity.apiKeyEncrypted)),
      "secret-for-same-identity",
      "a matching local endpoint may retain its existing credential",
    );
    assert.equal(sameIdentity.isDefault, "true", "a credential-backed matching restore may retain its selection state");
    assert.equal(sameIdentity.profileImportReviewRequired, "false");
    assert.ok(await connections.getWithKey("same-identity"));

    for (const id of ["changed-base", "changed-provider", "changed-embedding", "new-connection"]) {
      const connection = afterById.get(id)!;
      assert.equal(connection.apiKeyEncrypted, "", `${id} must not reuse or accept an imported credential`);
      assert.equal(connection.profileImportReviewRequired, "true", `${id} must wait for explicit local review`);
      assert.equal(await connections.getWithKey(id), null, `${id} must not make requests before review`);
      for (const field of ["isDefault", "fallbackForMain", "useForRandom", "defaultForAgents", "fallbackForAgents"]) {
        assert.equal(connection[field], "false", `${id}.${field} must wait for local credential review`);
      }
    }
    await connections.update("same-identity", {
      isDefault: false,
      fallbackForMain: false,
      defaultForAgents: false,
      fallbackForAgents: false,
    });
    await connections.update("changed-embedding", { isDefault: true });
    assert.equal(await connections.getDefault(), null, "the main default must exclude an unreviewed endpoint");
    await connections.update("changed-embedding", { isDefault: false, fallbackForMain: true });
    assert.equal(await connections.getFallbackForMain(), null, "the main fallback must exclude an unreviewed endpoint");
    await connections.update("changed-embedding", { fallbackForMain: false, defaultForAgents: true });
    assert.equal(
      await connections.getDefaultForAgents(),
      null,
      "the agent default must exclude an unreviewed endpoint",
    );
    await connections.update("changed-embedding", { defaultForAgents: false, fallbackForAgents: true });
    assert.equal(
      await connections.getFallbackForAgents(),
      null,
      "the agent fallback must exclude an unreviewed endpoint",
    );
    await connections.update("changed-base", { defaultForAgents: true });
    assert.equal(
      await connections.getDefaultForImageGeneration(),
      null,
      "the image default must exclude an unreviewed endpoint",
    );
    await connections.update("changed-base", { defaultForAgents: false, fallbackForAgents: true });
    assert.equal(
      await connections.getFallbackForImageGeneration(),
      null,
      "the image fallback must exclude an unreviewed endpoint",
    );
    await connections.update("changed-provider", { defaultForAgents: true });
    assert.equal(
      await connections.getDefaultForVideoGeneration(),
      null,
      "the video default must exclude an unreviewed endpoint",
    );
    await connections.update("changed-provider", { defaultForAgents: false, fallbackForAgents: true });
    assert.equal(
      await connections.getFallbackForVideoGeneration(),
      null,
      "the video fallback must exclude an unreviewed endpoint",
    );
    await connections.update("new-connection", { imagePath: "/api/connections/images/file/review.png" });
    assert.equal(
      await connections.getWithKey("new-connection"),
      null,
      "changing connection artwork alone must not approve an imported endpoint",
    );
    await connections.update("new-connection", { baseUrl: String(afterById.get("new-connection")!.baseUrl) });
    assert.ok(await connections.getWithKey("new-connection"), "saving locally must preserve the imported capability");

    const [instruction] = await db.select().from(schema.mariInstructions);
    assert.equal(instruction?.enabled, 0, "imported Professor Mari memories must start disabled");
    assert.equal(instruction?.persistent, 0, "imported Professor Mari memories must not auto-inject persistently");
    const [theme] = await db.select().from(schema.customThemes);
    assert.equal(theme?.isActive, "false", "modern profile themes must not activate imported CSS");
    const [tool] = await db.select().from(schema.customTools);
    assert.equal(tool?.enabled, "false");
    assert.equal(tool?.includeHiddenContext, "false");
    const extensions = await db.select().from(schema.installedExtensions);
    assert.equal(extensions.length, 2);
    const browserExtension = extensions.find((candidate) => candidate.id === importedExtension.id);
    const serverExtension = extensions.find((candidate) => candidate.id === importedServerExtension.id);
    assert.equal(browserExtension?.runtime, "client");
    assert.equal(serverExtension?.runtime, "server");
    assert.equal(browserExtension?.js, sourceOverOneMiB);
    assert.equal(serverExtension?.serverJs, sourceOverOneMiB);
    for (const extension of extensions) {
      assert.equal(extension.enabled, "false");
      assert.equal(extension.approvedHash, null);
    }

    const themes = themesModule.createThemesStorage(db);
    const localTheme = await themes.create({ name: "Local active theme", css: ":root { --background: blue; }" });
    await themes.setActive(localTheme!.id);
    const legacyPayload = {
      type: "marinara_profile",
      version: 1,
      exportedAt: timestamp,
      data: {
        themes: [
          {
            name: "Legacy imported theme",
            css: ":root { --background: green; }",
            installedAt: timestamp,
            isActive: true,
          },
        ],
      },
    };
    const legacyPreviewResponse = await app.inject({
      method: "POST",
      url: "/api/backup/import-profile?preview=true",
      payload: legacyPayload,
    });
    assert.equal(legacyPreviewResponse.statusCode, 200, legacyPreviewResponse.body);
    assert.ok(
      legacyPreviewResponse
        .json()
        .warnings.some((warning: { type: string }) => warning.type === "custom_themes_quarantined"),
      "legacy preview must disclose that imported active themes stay inactive",
    );
    const legacyPreview = legacyPreviewResponse.json();
    assert.equal(typeof legacyPreview.previewToken, "string");
    const legacyImportResponse = await app.inject({
      method: "POST",
      url: "/api/backup/import-profile",
      headers: { "x-profile-preview-token": legacyPreview.previewToken },
    });
    assert.equal(legacyImportResponse.statusCode, 200, legacyImportResponse.body);
    assert.equal((await themes.getActive())?.id, localTheme!.id, "legacy import must preserve the local active theme");
    const legacyImportedTheme = (await themes.list()).find((candidate) => candidate.name === "Legacy imported theme");
    assert.equal(legacyImportedTheme?.isActive, false, "legacy imported CSS must wait for explicit activation");
  } finally {
    await app.close();
    await dbModule.closeDB();
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  await rm(storageRoot, { recursive: true, force: true });
}

console.info("Profile import data security regressions passed.");
