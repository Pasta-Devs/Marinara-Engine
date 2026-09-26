import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-nanogpt-credentials-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createConnectionSchema } = await import("../../packages/shared/src/schemas/connection.schema.js");
const { sanitizeProfileTableRows, quarantineProfileApiConnectionRow } =
  await import("../../packages/server/src/routes/backup.routes.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const db = await getDB();
const storage = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionsRoutes, { prefix: "/connections" });
try {
  const connection = (await storage.create(
    createConnectionSchema.parse({
      name: "NanoGPT credential fixture",
      provider: "nanogpt",
      apiKey: "fixture-inference-key",
      managementToken: "fixture-management-token",
      showUsageWidget: true,
    }),
  ))!;
  assert.ok(connection.managementTokenEncrypted);
  assert.notEqual(connection.managementTokenEncrypted, "fixture-management-token");
  assert.equal(await storage.getManagementToken(connection.id), "fixture-management-token");
  for (const url of ["/connections", `/connections/${connection.id}`]) {
    const response = await app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 200);
    assert.ok(!response.body.includes("fixture-management-token"));
    assert.ok(!response.body.includes(connection.managementTokenEncrypted));
  }
  const copy = (await storage.duplicate(connection.id))!;
  assert.equal(await storage.getManagementToken(copy.id), "fixture-management-token");
  assert.equal(copy.showUsageWidget, "true");
  const exported = sanitizeProfileTableRows("api_connections", [connection]);
  assert.equal(exported[0]!.managementTokenEncrypted, "");
  assert.equal(exported[0]!.apiKeyEncrypted, "");
  const imported = quarantineProfileApiConnectionRow(connection);
  assert.equal(imported.row.managementTokenEncrypted, "");
  assert.equal(imported.row.profileImportReviewRequired, "true");
  await storage.update(connection.id, { managementToken: "" });
  assert.equal(await storage.getManagementToken(connection.id), null);
  await storage.update(copy.id, { provider: "openai" });
  assert.equal((await storage.getById(copy.id))!.managementTokenEncrypted, "");
  assert.equal((await storage.getById(copy.id))!.showUsageWidget, "false");
  const nonNano = await app.inject({ method: "GET", url: `/connections/${copy.id}/subscription-usage` });
  assert.equal(nonNano.statusCode, 400);
  console.info("NanoGPT credentials are encrypted, masked, copied, cleared, and excluded from profile exports.");
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
