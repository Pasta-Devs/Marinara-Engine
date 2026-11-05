import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import {
  buildCustomToolPatch,
  importCustomToolEntries,
  normalizeCustomToolImportEntry,
  prepareCustomToolImportEntry,
  serializeCustomToolForTransfer,
} from "../../packages/client/src/lib/custom-tool-transfer.js";

// #8516: saving an existing tool sends only what changed. A toggle never re-sends (and so never re-validates) a name or
// description stored by an import or by Mari, even one the editor would now reject.
{
  const stored = {
    id: "tool-1",
    name: "punch_tool\u200b",
    description: `punch -> physical_strength ${"=> ".repeat(300)}`,
    parametersSchema: JSON.stringify({ type: "object", required: [], properties: { a: { type: "string" } } }),
    executionType: "script",
    webhookUrl: null,
    staticResult: null,
    scriptBody: "return 1;",
    includeHiddenContext: "false",
    enabled: "true",
  } as Parameters<typeof buildCustomToolPatch>[0];
  const unchanged = serializeCustomToolForTransfer(stored);
  assert.deepEqual(buildCustomToolPatch(stored, unchanged), {}, "nothing changed: nothing is sent");
  assert.deepEqual(
    buildCustomToolPatch(stored, { ...unchanged, includeHiddenContext: true }),
    { includeHiddenContext: true },
    "a toggle sends only the toggle",
  );
  // The same schema rebuilt with its keys in another order is not a change.
  const reordered = { properties: { a: { type: "string" } }, required: [], type: "object" };
  assert.deepEqual(buildCustomToolPatch(stored, { ...unchanged, parametersSchema: reordered }), {});
  assert.deepEqual(buildCustomToolPatch(stored, { ...unchanged, name: "punch_tool" }), { name: "punch_tool" });
}

const requestedWebhook = {
  name: "send_private_context",
  description: "Send private context to a remote service",
  executionType: "webhook",
  webhookUrl: "https://user:password@example.com:8443/private/collect?token=secret",
  includeHiddenContext: true,
  enabled: true,
};

const preparedWebhook = prepareCustomToolImportEntry(requestedWebhook);
assert.ok(preparedWebhook);
assert.equal(preparedWebhook.config.enabled, false, "imported webhooks must never preserve enabled state");
assert.equal(
  preparedWebhook.config.includeHiddenContext,
  false,
  "imported webhooks must never preserve hidden-context access",
);
assert.deepEqual(preparedWebhook.review, {
  name: "send_private_context",
  executionType: "webhook",
  destinationOrigin: "https://example.com:8443",
  requestedEnabled: true,
  requestedHiddenContext: true,
});
assert.doesNotMatch(
  JSON.stringify(preparedWebhook.review),
  /password|private\/collect|token=secret/,
  "the review summary must not expose URL credentials, paths, queries, or fragments",
);

const normalizedWebhook = normalizeCustomToolImportEntry(requestedWebhook);
assert.ok(normalizedWebhook);
assert.equal(normalizedWebhook.enabled, false);
assert.equal(normalizedWebhook.includeHiddenContext, false);

const invalidWebhook = prepareCustomToolImportEntry({
  ...requestedWebhook,
  name: "invalid_webhook",
  webhookUrl: "not a URL",
});
assert.ok(invalidWebhook);
assert.equal(invalidWebhook.review?.destinationOrigin, null);

const staticTool = normalizeCustomToolImportEntry({
  name: "static_lookup",
  description: "Return trusted static content",
  executionType: "static",
  staticResult: "safe",
  includeHiddenContext: true,
  enabled: true,
});
assert.ok(staticTool);
assert.equal(staticTool.enabled, true, "static imports must retain their existing enabled behavior");
assert.equal(staticTool.includeHiddenContext, true);

const preparedScript = prepareCustomToolImportEntry({
  name: "trusted_script",
  description: "Run a locally reviewed script",
  executionType: "script",
  scriptBody: "return args;",
  includeHiddenContext: true,
  enabled: true,
});
assert.ok(preparedScript);
assert.equal(preparedScript.config.enabled, false, "imported scripts must wait for local review");
assert.equal(
  preparedScript.config.includeHiddenContext,
  false,
  "imported scripts must not inherit private context access",
);
assert.equal(preparedScript.review?.executionType, "script");

const created: Record<string, unknown>[] = [];
const importResult = await importCustomToolEntries(
  [
    {
      raw: requestedWebhook,
      path: "functions.json",
      basePath: "",
      resolveTextFile: () => null,
    },
    {
      raw: staticTool,
      path: "functions.json",
      basePath: "",
      resolveTextFile: () => null,
    },
  ],
  {
    mutateAsync: async (data) => {
      created.push(data);
      return data;
    },
  },
);
assert.equal(importResult.imported, 2);
assert.equal(importResult.failed.length, 0);
assert.equal(importResult.reviews.length, 1, "only imported webhooks need a privilege review");
assert.equal(created[0]?.enabled, false);
assert.equal(created[0]?.includeHiddenContext, false);

const localWebhookExport = serializeCustomToolForTransfer({
  id: "local-tool",
  name: "local_webhook",
  description: "Locally configured webhook",
  parametersSchema: "{}",
  executionType: "webhook",
  webhookUrl: "https://example.com/hook",
  staticResult: null,
  scriptBody: null,
  includeHiddenContext: "true",
  enabled: "true",
  sortOrder: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});
assert.equal(localWebhookExport.enabled, true, "local tool state must remain exportable");
assert.equal(localWebhookExport.includeHiddenContext, true, "local hidden-context choices must remain exportable");

const storageRoot = await mkdtemp(join(tmpdir(), "marinara-custom-tool-security-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
try {
  process.env.DATA_DIR = storageRoot;
  process.env.FILE_STORAGE_DIR = join(storageRoot, "storage");
  const [
    { getDB, closeDB },
    { customTools },
    { createCustomToolsStorage },
    { backupRoutes },
    { ENCRYPTED_WEBHOOK_PREFIX },
  ] = await Promise.all([
    import("../../packages/server/src/db/connection.js"),
    import("../../packages/server/src/db/schema/index.js"),
    import("../../packages/server/src/services/storage/custom-tools.storage.js"),
    import("../../packages/server/src/routes/backup.routes.js"),
    import("../../packages/server/src/utils/custom-tool-webhook.js"),
  ]);
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  try {
    await app.register(backupRoutes, { prefix: "/api/backup" });
    await app.ready();
    const storage = createCustomToolsStorage(db);
    const createdWebhook = await storage.create({
      name: "encrypted_webhook",
      description: "Encryption regression",
      parametersSchema: {},
      executionType: "webhook",
      webhookUrl: "https://example.com/hook?secret=value",
      includeHiddenContext: false,
      enabled: false,
    });
    const [raw] = await db.select().from(customTools);
    assert.match(raw?.webhookUrl ?? "", /^enc:v1:/u, "webhook credentials must be encrypted in storage");
    assert.doesNotMatch(raw?.webhookUrl ?? "", /example\.com|secret=value/u);
    assert.equal(
      (await storage.getById(createdWebhook.id))?.webhookUrl,
      "https://example.com/hook?secret=value",
      "the owner can still use and edit the configured webhook",
    );

    const importedAt = new Date(0).toISOString();
    const importedProfileTool = {
      id: "foreign-encrypted-webhook",
      name: "foreign_encrypted_webhook",
      description: "Foreign encrypted profile fixture",
      parametersSchema: "{}",
      executionType: "webhook",
      webhookUrl: `${ENCRYPTED_WEBHOOK_PREFIX}invalid`,
      staticResult: null,
      scriptBody: null,
      includeHiddenContext: "true",
      enabled: "true",
      sortOrder: 20,
      createdAt: importedAt,
      updatedAt: importedAt,
    };
    const malformedProfileTool = {
      ...importedProfileTool,
      id: "malformed-webhook",
      name: "malformed_webhook",
      webhookUrl: 42,
    };
    const importResponse = await app.inject({
      method: "POST",
      url: "/api/backup/import-profile",
      payload: {
        type: "marinara_profile",
        version: 1,
        exportedAt: importedAt,
        data: {
          fileStorage: {
            version: 1,
            tables: { custom_tools: [importedProfileTool, malformedProfileTool] },
            files: [],
          },
        },
      },
    });
    assert.equal(importResponse.statusCode, 200, importResponse.body);
    const importedRead = await storage.getById("foreign-encrypted-webhook");
    assert.ok(importedRead, "a tool with a cleared foreign credential remains readable after profile import");
    assert.equal(importedRead.webhookUrl, null, "profile import clears credentials encrypted by another install");
    assert.equal(importedRead.enabled, "false", "profile import quarantines executable tools");
    assert.equal(importedRead.includeHiddenContext, "false", "profile import removes private-context access");
    const malformedRead = await storage.getById("malformed-webhook");
    assert.ok(malformedRead, "a malformed imported webhook remains readable after normalization");
    assert.equal(malformedRead.webhookUrl, null, "non-string imported webhook values are cleared");
    assert.equal(malformedRead.enabled, "false");
    assert.equal(malformedRead.includeHiddenContext, "false");
  } finally {
    await app.close();
    await closeDB();
  }
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  await rm(storageRoot, { recursive: true, force: true });
}

console.info("Custom tool import security regressions passed.");
