import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CapabilityPersistenceHost,
  CapabilityPersistenceSession,
} from "../../packages/shared/src/types/capability-runtime.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-permission-proof-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = serverRequire("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createCapabilityPersistenceHost } =
  await import("../../packages/server/src/services/capability-packages/capability-persistence.service.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { capabilityModuleRuntime } =
  await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
const { getCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
const timestamp = new Date().toISOString();
const permissions = [[], ["chat-read"], ["chat-write"], ["chat-read", "chat-write"]];
const packages = permissions.map((granted, index) => {
  const id = `permission-proof-${index}`;
  const source = `export function activate(context) { return context.api.registerService("${id}", context.api.runtime.persistence); }`;
  const manifest = {
    schemaVersion: 1,
    id,
    name: id,
    version: "1.0.0",
    description: "Local permission proof",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { server: "server.mjs" },
    permissions: granted,
    restartRequired: false,
    files: [
      {
        path: "server.mjs",
        bytes: Buffer.byteLength(source),
        sha256: createHash("sha256").update(source).digest("hex"),
      },
    ],
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
});
writeFileSync(join(dir, "capability-packages", "installed.json"), JSON.stringify({ schemaVersion: 1, packages }));
try {
  const chat = (await createChatsStorage(db).create({
    name: "Permission proof",
    mode: "roleplay",
    characterIds: [],
    promptPresetId: null,
  }))!;
  const trusted = createCapabilityPersistenceHost(db);
  const metadata = (value: string) => ({ chatId: chat.id, metadata: { proof: value }, updatedAt: timestamp });
  const snapshot = {
    id: "snapshot-proof",
    chatId: chat.id,
    messageId: "",
    swipeIndex: 0,
    currentLocationId: "harbor",
    definitionRevision: 1,
    source: "bootstrap" as const,
    transitionCommandId: null,
    transitionPayloadHash: null,
    createdAt: timestamp,
  };
  const reads: Array<(host: CapabilityPersistenceSession) => Promise<unknown>> = [
    (h) => h.listChats(),
    (h) => h.getChat(chat.id),
    (h) => h.listMessages(chat.id),
    (h) => h.getGameState!(chat.id),
    (h) => h.spatialSnapshots.getById(snapshot.id),
    (h) => h.spatialSnapshots.getByAnchor(chat.id, "", 0),
    (h) => h.spatialSnapshots.getByCommand(chat.id, "command"),
    (h) => h.spatialSnapshots.listByAnchors(chat.id, []),
    (h) => h.spatialSnapshots.listForChat(chat.id),
    (h) => h.spatialSnapshots.hasMessageSnapshots(chat.id),
    (h) => h.spatialSnapshots.getLatest(chat.id),
    (h) => h.spatialSnapshots.getBootstrap(chat.id),
  ];
  const writes: Array<(host: CapabilityPersistenceSession) => Promise<unknown>> = [
    (h) => h.updateChatMetadata(metadata("denied")),
    (h) => h.updateChatActivity({ chatId: chat.id, updatedAt: timestamp, lastMessageAt: timestamp }),
    (h) => h.markGameStateSnapshotCommitted(chat.id, "missing-snapshot"),
    (h) =>
      h.createMessageWithSwipe({
        id: "message",
        swipeId: "swipe",
        chatId: chat.id,
        role: "assistant",
        characterId: null,
        content: "Denied",
        extra: {},
        createdAt: timestamp,
      }),
    (h) =>
      h.appendRoleplayEvent!({
        id: "event",
        chatId: chat.id,
        messageId: "message",
        swipeIndex: 0,
        sourcePackageId: "proof",
        eventType: "note",
        subjectCharacterIds: [],
        audience: "public",
        text: "Denied",
        data: {},
        createdAt: timestamp,
        idempotencyKey: "event",
      }),
    (h) => h.spatialSnapshots.create(snapshot),
    (h) => h.spatialSnapshots.replaceBootstrap(snapshot),
    (h) => h.spatialSnapshots.replaceAtAnchor(snapshot),
  ];
  for (const item of packages) {
    // Actual registry read, digest verification, runtime snapshot, module import,
    // activation and service registration; no runtime or persistence mocks.
    const activated = await capabilityModuleRuntime.activatePackage(app, item.id);
    assert.equal(activated.readiness, "ready");
    const host = getCapabilityService<CapabilityPersistenceHost>(item.id)!;
    assert.ok(host);
    const canRead = item.manifest.permissions.includes("chat-read");
    const canWrite = item.manifest.permissions.includes("chat-write");
    if (!canRead)
      for (const read of reads) {
        await assert.rejects(() => read(host), /requires chat-read permission/);
        await assert.rejects(() => host.transaction(read), /requires chat-read permission/);
      }
    if (!canWrite)
      for (const write of writes) {
        await assert.rejects(() => write(host), /requires chat-write permission/);
        await assert.rejects(() => host.transaction(write), /requires chat-write permission/);
      }
    if (canRead) assert.equal((await host.getChat(chat.id))?.id, chat.id);
    if (canWrite) {
      await host.transaction((session) => session.updateChatMetadata(metadata(item.id)));
      assert.equal(JSON.parse((await trusted.getChat(chat.id))!.metadata as string).proof, item.id);
      await host.spatialSnapshots.replaceBootstrap(snapshot);
      assert.equal((await trusted.spatialSnapshots.getBootstrap(chat.id))?.currentLocationId, "harbor");
    }
    if (canRead) assert.ok(Array.isArray(await host.spatialSnapshots.listForChat(chat.id)));
    if (!canRead && !canWrite) {
      let called = false;
      await assert.rejects(
        () =>
          host.withChatLock(chat.id, async () => {
            called = true;
          }),
        /chat-read or chat-write/,
      );
      assert.equal(called, false);
    } else {
      await host.withChatLock(chat.id, async () => {
        if (canRead) assert.equal((await host.getChat(chat.id))?.id, chat.id);
        else await assert.rejects(() => host.getChat(chat.id), /requires chat-read/);
        if (!canWrite) await assert.rejects(() => host.updateChatMetadata(metadata("denied")), /requires chat-write/);
      });
    }
    await capabilityModuleRuntime.deactivatePackage(item.id);
    assert.equal(getCapabilityService(item.id), null);
  }
  const mutable: string[] = [];
  const restricted = createCapabilityPersistenceHost(db, mutable);
  mutable.push("chat-write");
  await assert.rejects(() => restricted.updateChatMetadata(metadata("mutated")), /requires chat-write/);
  assert.deepEqual(await trusted.listMessages(chat.id), [], "denied writes created no messages or swipes");
} finally {
  await capabilityModuleRuntime.stop();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Activated package chat permissions gate persistence, spatial snapshots, locks and transaction sessions.");
