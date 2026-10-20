/**
 * 3D Avatars after one-click Tripo models were withdrawn (maintainer decision, 2026-10-19: Tripo models have no
 * face rig, so their mouth can't move; VRoid Studio and Import VRM are the way to get a model):
 *   - the Tripo key and VRM model routes are gone (404), and no client, server or shared source names Tripo's
 *     addresses or those routes, so nothing can call Tripo;
 *   - a key saved for the generator stays in storage, untouched by those routes and by every boot; it never
 *     reaches a log or a profile export, and Clear data's Connections scope still removes it;
 *   - Tripo is no longer a provider in Connections, and the boot migration still moves an old Tripo
 *     connection's key into storage and deletes the connection (and what pointed to it), once;
 *   - a model the generator made earlier still imports as a body-only VRM 1.0 model with its terms, and the
 *     import says its face doesn't move.
 * The generator's own checks (the Tripo client, the GLB to VRM converter, the run and the key routes) were removed
 * with it. Rendering and motion of such a model stay covered by avatar-vrm.regression.ts and avatar-vrm.e2e.ts.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "node:util";
import { tripoMadeVrm } from "./fixtures/avatar-3d-fixtures.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-avatar-vrm-tripo-removed-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const Fastify = createRequire(new URL("../../packages/server/package.json", import.meta.url))("fastify");
const { PROVIDERS, apiProviderSchema, createAgentConfigSchema, createConnectionSchema } =
  await import("../../packages/shared/src/index.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { apiConnections } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { encryptApiKey } = await import("../../packages/server/src/utils/crypto.js");
const { sanitizeProfileTableRows } = await import("../../packages/server/src/routes/backup.routes.js");
const { logger } = await import("../../packages/server/src/lib/logger.js");
const { vrmImporter, buildVrmImport } = await import("../../packages/server/src/services/avatars/formats/vrm.js");
const { TRIPO_API_KEY_SETTING, migrateTripoConnectionsToApiKey, readTripoApiKey } =
  await import("../../packages/server/src/services/avatars/generation/tripo-key.js");
const { avatarGenerationRoutes } = await import("../../packages/server/src/routes/avatar-generation.routes.js");
const { adminRoutes } = await import("../../packages/server/src/routes/admin.routes.js");

const KEY = "tsk_regression_key_7f3a9c";
const owner = { ownerType: "character", ownerId: "char_tripo" } as const;

// ── Nothing left that could call Tripo ──
{
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/u.test(entry.name)) {
        const text = readFileSync(path, "utf8");
        // A route path, not a module name such as tripo-key.js or vrm-model-prompt.ts.
        if (/tripo3d\.ai|\/(?:tripo-key|vrm-model)(?![\w.-])/u.test(text)) offenders.push(path.slice(root.length));
      }
    }
  };
  for (const pkg of ["client", "server", "shared"]) walk(join(root, "packages", pkg, "src"));
  assert.deepEqual(offenders, [], "no source names Tripo's addresses or the removed routes");
}

// ── A model the generator made earlier ──
{
  const input = { owner, filename: "model.vrm", bytes: new Uint8Array(tripoMadeVrm()) };
  const built = buildVrmImport(await vrmImporter.validate(input), input, null);
  assert.equal(built.data.specVersion, "1.0");
  assert.deepEqual(built.data.expressionNames, [], "body only: no face expressions");
  assert.equal(built.data.meta?.title, "Maukie");
  assert.deepEqual(built.data.meta?.authors, ["Tripo AI"]);
  assert.equal(built.data.meta?.termsUrl, "https://developers.tripo3d.ai/en/terms", "its terms still link Tripo's");
  assert.ok(
    built.warnings.includes("This model has no face expressions, so its face doesn't move."),
    "the import says the face doesn't move",
  );
  assert.equal(
    built.warnings.some((warning) => warning.includes("You can pick them in setup")),
    false,
    "no offer to pick expressions the model doesn't have",
  );
}

const db = await getDB();
try {
  const connections = createConnectionsStorage(db);
  const settings = createAppSettingsStorage(db);

  // Tripo is no longer a provider in Connections.
  assert.equal("tripo" in PROVIDERS, false, "Connections doesn't offer Tripo");
  assert.equal(apiProviderSchema.safeParse("tripo").success, false);
  assert.equal(createConnectionSchema.safeParse({ name: "Tripo", provider: "tripo", apiKey: KEY }).success, false);

  // Staging testers have Tripo connections from before the key moved to the 3D Avatars page. The one listed
  // first has a key that can't be read (encrypted with another encryption key); the next one's key moves.
  const legacyTripo = async (name: string, apiKeyEncrypted: string, updatedAt: string) => {
    const row = await connections.create(createConnectionSchema.parse({ name, provider: "custom", apiKey: "x" }));
    await db
      .update(apiConnections)
      .set({ provider: "tripo" as never, apiKeyEncrypted, isDefault: "true", defaultForAgents: "true", updatedAt })
      .where(eq(apiConnections.id, row.id));
    return row.id;
  };
  const brokenId = await legacyTripo("Old Tripo", "00ff:abcd:1234", "2026-10-14T12:00:02.000Z");
  const tripoId = await legacyTripo("My Tripo", encryptApiKey(KEY), "2026-10-14T12:00:01.000Z");
  const chat = await connections.create(
    createConnectionSchema.parse({ name: "Chat", provider: "openai", apiKey: "sk" }),
  );
  const agents = createAgentsStorage(db);
  const agent = await agents.create(
    createAgentConfigSchema.parse({
      type: "tripo-fixture",
      name: "Fixture",
      phase: "post_processing",
      connectionId: tripoId,
    }),
  );
  const migrationLog: string[] = [];
  const quiet = { info: logger.info, warn: logger.warn, debug: logger.debug };
  for (const level of ["info", "warn", "debug"] as const) {
    (logger as Record<string, unknown>)[level] = (...args: unknown[]) => migrationLog.push(format(...args));
  }
  try {
    await migrateTripoConnectionsToApiKey(db);
  } finally {
    Object.assign(logger, quiet);
  }
  assert.equal(await readTripoApiKey(db), KEY, "the readable key moved into storage");
  const storedKey = (await settings.get(TRIPO_API_KEY_SETTING)) ?? "";
  assert.ok(storedKey && !storedKey.includes(KEY), "the moved key is stored encrypted");
  assert.deepEqual(
    (await connections.list()).filter((row: { provider: unknown }) => String(row.provider) === "tripo"),
    [],
    "every Tripo connection is deleted",
  );
  assert.equal(await connections.getById(brokenId), null, "even one whose key can't be read");
  assert.equal((await agents.getById(agent.id))?.connectionId ?? null, null, "an agent that used one is cleared");
  assert.ok((await connections.getById(chat.id)) !== null, "other connections stay");
  assert.ok(
    migrationLog.some((line) => line.includes("Removed 2 Tripo connection(s)")),
    migrationLog.join("\n"),
  );
  assert.equal(migrationLog.join("\n").includes(KEY), false, "the migration never logs the key");
  // Running again (every boot) changes nothing; a later stray Tripo connection never replaces a saved key.
  await migrateTripoConnectionsToApiKey(db);
  assert.equal(await settings.get(TRIPO_API_KEY_SETTING), storedKey, "a second run is a no-op");
  const strayId = await legacyTripo("Stray Tripo", encryptApiKey("tsk_other_key"), "2026-10-14T12:00:03.000Z");
  await migrateTripoConnectionsToApiKey(db);
  assert.equal(await readTripoApiKey(db), KEY, "a saved key is kept");
  assert.equal(await connections.getById(strayId), null);

  // Profile exports leave the key out, as they blank connection keys.
  assert.deepEqual(
    sanitizeProfileTableRows("app_settings", [
      { key: TRIPO_API_KEY_SETTING, value: storedKey },
      { key: "ui", value: "{}" },
    ]).map((row) => row.key),
    ["ui"],
  );

  // The generator's routes are gone: each answers 404, and the saved key stays exactly as it was.
  const app = Fastify();
  app.decorate("db", db);
  await app.register(avatarGenerationRoutes);
  await app.register(adminRoutes, { prefix: "/api/admin" });
  const routeLog: string[] = [];
  const loud = { info: logger.info, warn: logger.warn, error: logger.error, debug: logger.debug };
  for (const level of ["info", "warn", "error", "debug"] as const) {
    (logger as Record<string, unknown>)[level] = (...args: unknown[]) => routeLog.push(format(...args));
  }
  try {
    const removed = [
      { method: "GET", url: "/tripo-key" },
      { method: "PUT", url: "/tripo-key", payload: { apiKey: "tsk_replacement" } },
      { method: "DELETE", url: "/tripo-key" },
      { method: "GET", url: "/vrm-model/balance" },
      { method: "POST", url: "/vrm-model", payload: { owner, sourceLabel: "full_neutral" } },
    ] as const;
    for (const request of removed) {
      const answer = await app.inject(request);
      assert.equal(answer.statusCode, 404, `${request.method} ${request.url} is gone`);
      assert.equal(answer.body.includes(KEY.slice(-6)), false, "no part of the key comes back");
    }
    assert.equal(await settings.get(TRIPO_API_KEY_SETTING), storedKey, "the saved key is left untouched");

    // Clear data's Connections scope still removes the key, the one way to get rid of it now.
    const expunged = await app.inject({
      method: "POST",
      url: "/api/admin/expunge",
      payload: { confirm: true, scopes: ["connections"] },
    });
    assert.equal(expunged.statusCode, 200, expunged.body);
    assert.equal(await settings.get(TRIPO_API_KEY_SETTING), null, "clearing Connections removes the Tripo API key");
  } finally {
    Object.assign(logger, loud);
    await app.close();
  }
  assert.equal(routeLog.join("\n").includes(KEY), false, "the key is never logged");
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("avatar VRM Tripo removal regression passed");
