/**
 * Capability API 1.818: a package reads and writes only its own documents (refused from 1.818, warned before), and
 * reads tracker state through `runtime.gameState.read`, with the location the prompt gets.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapabilityRuntimeHost } from "../../packages/shared/src/types/capability-runtime.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-scoped-documents-"));
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
const { getCapabilityService, registerCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { supportedCapabilityApi } = await import("../../packages/shared/src/schemas/capability-package.schema.js");

assert.ok(supportedCapabilityApi.major === 1 && supportedCapabilityApi.minor >= 818, "ships as capability API 1.818");

const timestamp = new Date().toISOString();

function fixturePackage(id: string, permissions: string[], minor: number | null) {
  const source = `export function activate(context) { context.api.registerService("${id}:runtime", context.api.runtime); }\n`;
  const base = {
    id,
    name: id,
    version: "1.0.0",
    description: "Scoped documents proof",
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
  return { id, version: "1.0.0", manifest, installedAt: timestamp, status: "active", readiness: "ready", error: null };
}

const packages = [
  fixturePackage("docs-current", ["chat-read"], 818),
  fixturePackage("docs-legacy", [], null),
  fixturePackage("docs-no-chat-read", [], 818),
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
const doc = (packageId: string, id: string) => ({
  id,
  packageId,
  kind: "note",
  name: id,
  description: "",
  data: { id },
  createdAt: timestamp,
  updatedAt: timestamp,
});

try {
  for (const { id } of packages) {
    assert.equal((await capabilityModuleRuntime.activatePackage(app, id)).readiness, "ready", id);
  }
  const current = getCapabilityService<CapabilityRuntimeHost>("docs-current:runtime")!;
  const legacy = getCapabilityService<CapabilityRuntimeHost>("docs-legacy:runtime")!;
  const noChatRead = getCapabilityService<CapabilityRuntimeHost>("docs-no-chat-read:runtime")!;

  // ── a package uses its own documents freely ──
  const own = await current.persistence.documents.create(doc("docs-current", "own-1"));
  assert.equal((await current.persistence.documents.getById("docs-current", own.id))?.id, "own-1");
  assert.equal((await legacy.persistence.documents.create(doc("docs-legacy", "legacy-1"))).id, "legacy-1");

  // ── a package declaring 1.818 cannot touch another package's documents, inside a transaction either ──
  const foreign = /can only use its own documents, not docs-legacy's/;
  await assert.rejects(current.persistence.documents.list("docs-legacy", "note"), foreign);
  await assert.rejects(current.persistence.documents.getById("docs-legacy", "legacy-1"), foreign);
  await assert.rejects(current.persistence.documents.create(doc("docs-legacy", "spoofed")), foreign);
  await assert.rejects(
    current.persistence.documents.update({
      ...doc("docs-legacy", "legacy-1"),
      expectedRevision: 1,
    }),
    foreign,
  );
  await assert.rejects(current.persistence.documents.remove("docs-legacy", "legacy-1", 1), foreign);
  await assert.rejects(
    current.persistence.transaction((session) => session.documents.list("docs-legacy", "note")),
    foreign,
  );
  await assert.rejects(current.persistence.documents.list("__engine__:chat", "roleplay-event"), /own documents/);

  // ── an older package keeps working, with one warning per foreign owner ──
  assert.equal((await legacy.persistence.documents.list("docs-current", "note")).length, 1);
  assert.equal((await legacy.persistence.documents.list("docs-current", "note")).length, 1);
  assert.equal(warnings.filter((line) => line.includes("docs-legacy can only use its own documents")).length, 1);

  // ── gameState.read: chat-read, the latest committed state, parsed ──
  await assert.rejects(noChatRead.gameState!.read("missing"), /chat-read/);
  assert.equal(await current.gameState!.read("missing"), null);
  const chats = createChatsStorage(db);
  const chat = (await chats.create({ name: "Tracker", mode: "roleplay", characterIds: [], promptPresetId: null }))!;
  assert.equal(await current.gameState!.read(chat.id), null, "no committed state yet");
  const states = createGameStateStorage(db);
  const snapshotId = await states.create({
    chatId: chat.id,
    messageId: "msg-1",
    swipeIndex: 0,
    date: "Day 1",
    time: "Noon",
    location: "Old Mill",
    weather: "Rain",
    temperature: "Cold",
    worldCustomFields: [{ name: "Omen", value: "Crows" }],
    presentCharacters: [
      {
        characterId: "c1",
        name: "Ada",
        emoji: "",
        mood: "Calm",
        appearance: null,
        outfit: "Coat",
        customFields: {},
        stats: [],
        thoughts: null,
      },
    ],
    recentEvents: [],
    playerStats: null,
    personaStats: [{ name: "Energy", value: 20, max: 100, color: "" }],
  });
  await states.commit(snapshotId, chat.id);
  const view = await current.gameState!.read(chat.id);
  assert.equal(view?.location, "Old Mill");
  assert.equal(view?.weather, "Rain");
  assert.equal(view?.presentCharacters[0]?.outfit, "Coat");
  assert.equal(view?.personaStats?.[0]?.value, 20);
  assert.deepEqual(
    view?.worldCustomFields.map(({ name, value }) => [name, value]),
    [["Omen", "Crows"]],
  );

  // ── with Hierarchical Maps on for the chat, the location is its projection, as in the prompt ──
  const releaseProjection = registerCapabilityService("hierarchical-maps:projection", {
    resolveOwnerSpatialProjection: async () => ({ ownerMode: "roleplay", breadcrumb: [] }),
    projectGameSnapshotLocation: <T extends object>(row: T | null) =>
      row ? ({ ...row, location: "Town > Mill" } as T) : row,
  });
  try {
    await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: ["hierarchical-maps"] });
    assert.equal((await current.gameState!.read(chat.id))?.location, "Town > Mill");
  } finally {
    releaseProjection();
  }
} finally {
  (logger as unknown as { warn: unknown }).warn = originalWarn;
  await capabilityModuleRuntime.stop();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Packages keep to their own documents and read tracker state through the Engine.");
