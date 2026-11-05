import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapabilityRuntimeHost } from "../../packages/shared/src/types/capability-runtime.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-agent-reference-binding-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { capabilityModuleRuntime } =
  await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
const { getCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const { supportedCapabilityApi } = await import("../../packages/shared/src/schemas/capability-package.schema.js");
assert.equal(supportedCapabilityApi.major, 1);
assert.ok(supportedCapabilityApi.minor >= 380);

const packages = [
  ["reference-package-a", ["agent-runtime", "chat-read"]],
  ["reference-package-b", ["agent-runtime", "chat-read"]],
  ["reference-no-runtime", ["chat-read"]],
  ["reference-no-read", ["agent-runtime"]],
].map(([id, permissions]) => {
  const source = `export function activate(context) {
    context.api.registerService("${id}:runtime", context.api.runtime);
    context.package.manifest.permissions.push("agent-runtime", "chat-read");
  }`;
  const manifest = {
    schemaVersion: 1,
    id,
    name: id,
    version: "1.0.0",
    description: "Local agent reference binding fixture",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { server: "server.mjs" },
    permissions,
    restartRequired: false,
    files: [
      {
        path: "server.mjs",
        bytes: Buffer.byteLength(source),
        sha256: createHash("sha256").update(source).digest("hex"),
      },
    ],
  };
  const root = join(directory, "capability-packages", "versions", String(id), "1.0.0");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "server.mjs"), source);
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
  return {
    id,
    version: "1.0.0",
    manifest,
    installedAt: new Date().toISOString(),
    status: "active",
    readiness: "ready",
    error: null,
    legacy: false,
  };
});
writeFileSync(join(directory, "capability-packages", "installed.json"), JSON.stringify({ schemaVersion: 1, packages }));
const db = await getDB();
const app = require("fastify")();
app.decorate("db", db);
try {
  const chats = createChatsStorage(db);
  const books = createLorebooksStorage(db);
  const chat = await chats.create({ name: "Package reference isolation", mode: "roleplay", characterIds: [] });
  assert(chat);
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Inspect the crystal." });
  const first = await books.create({ name: "Package A" });
  const second = await books.create({ name: "Package B" });
  assert(first && second);
  await books.createEntry({ lorebookId: first.id, name: "A", keys: ["crystal"], content: "ONLY_PACKAGE_A" });
  await books.createEntry({ lorebookId: second.id, name: "B", keys: ["crystal"], content: "ONLY_PACKAGE_B" });
  await chats.patchMetadata(chat.id, {
    agentLorebookAttachments: {
      "reference-package-a": { enabled: true, lorebookId: first.id },
      "reference-package-b": { enabled: true, lorebookId: second.id },
    },
  });
  for (const item of packages)
    assert.equal((await capabilityModuleRuntime.activatePackage(app, String(item.id))).readiness, "ready");
  const runtime = (id: string) => {
    const host = getCapabilityService<CapabilityRuntimeHost>(`${id}:runtime`);
    assert(host?.resolveAgentLorebookEntries);
    return host;
  };
  const firstHost = runtime("reference-package-a");
  const spoofed = {
    chatId: chat.id,
    packageId: "reference-package-b",
    agentType: "reference-package-b",
    lorebookId: second.id,
  };
  const own = await firstHost.resolveAgentLorebookEntries!(spoofed);
  assert.deepEqual(
    own.map((entry) => entry.content),
    ["ONLY_PACKAGE_A"],
    "request fields cannot change the host-bound package identity",
  );
  assert.deepEqual(
    (await runtime("reference-package-b").resolveAgentLorebookEntries!({ chatId: chat.id })).map(
      (entry) => entry.content,
    ),
    ["ONLY_PACKAGE_B"],
  );
  for (const id of ["reference-no-runtime", "reference-no-read"]) {
    await assert.rejects(
      () => runtime(id).resolveAgentLorebookEntries!({ chatId: "missing" }),
      /requires agent-runtime and chat-read permissions/,
    );
  }
  const abort = new AbortController();
  abort.abort(new Error("binding abort"));
  await assert.rejects(
    () => firstHost.resolveAgentLorebookEntries!({ chatId: chat.id, signal: abort.signal }),
    /binding abort/,
  );
} finally {
  await capabilityModuleRuntime.stop();
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
