/**
 * Capability API 1.817: the package event bus. Publishing stays in the package's own namespace, a slow or failing
 * subscriber never reaches the publisher, Engine events that carry chat content need `chat-read`, a publish from a
 * handler is queued, teardown releases subscriptions, and a chat-scoped event rides that chat's generation stream.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-event-bus-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = serverRequire("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { capabilityModuleRuntime } =
  await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
const { getCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const bus = await import("../../packages/server/src/services/capability-packages/capability-event-bus.service.js");
const { createGenerationEventSink, sendSseEvent } = await import("../../packages/server/src/routes/generate/sse.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { runWithRoomGeneration } = await import("../../packages/server/src/services/multiplayer/generation-policy.js");
const { supportedCapabilityApi } = await import("../../packages/shared/src/schemas/capability-package.schema.js");

assert.ok(supportedCapabilityApi.major === 1 && supportedCapabilityApi.minor >= 817, "ships as capability API 1.817");

const timestamp = new Date().toISOString();
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function fixturePackage(id: string, permissions: string[], source: string) {
  const manifest = {
    schemaVersion: 2,
    capabilityApi: { major: 1, minor: 817 },
    builtAgainst: { engineVersion: "2.3.0", engineCommit: "a".repeat(40) },
    id,
    name: id,
    version: "1.0.0",
    description: "Event bus proof",
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
  const root = join(dir, "capability-packages", "versions", id, "1.0.0");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "server.mjs"), source);
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
  return { id, version: "1.0.0", manifest, installedAt: timestamp, status: "active", readiness: "ready", error: null };
}

// The listener records what it receives into a service the test reads; the publisher hands its `events` out.
const listenerSource = `export function activate(context) {
  const seen = [];
  context.api.registerService("bus-listener:seen", seen);
  context.api.events.subscribe("bus-publisher:*", (event) => {
    seen.push({ type: event.type, source: event.source, chatId: event.chatId, payload: event.payload, frozen: Object.isFrozen(event.payload) });
    if (event.type === "bus-publisher:ping") context.api.events.publish("bus-listener:pong", { inside: seen.length });
  });
  context.api.events.subscribe("bus-listener:pong", (event) => { seen.push({ type: event.type, payload: event.payload }); });
  context.api.events.subscribe("engine:*", (event) => { seen.push({ type: event.type, payload: event.payload }); });
  // A subscriber that never answers and one that throws: neither reaches the publisher.
  context.api.events.subscribe("bus-publisher:ping", () => new Promise(() => {}));
  context.api.events.subscribe("bus-publisher:ping", () => { throw new Error("listener failure"); });
}
`;
const publisherSource = `export function activate(context) {
  context.api.registerService("bus-publisher:events", context.api.events);
}
`;
const noChatReadSource = `export function activate(context) {
  context.api.events.subscribe("engine:agent.result", () => {});
}
`;
const lifecycleOnlySource = `export function activate(context) {
  context.api.events.subscribe("engine:package.activated", () => {});
  context.api.registerService("bus-lifecycle:ok", true);
}
`;
const packages = [
  fixturePackage("bus-listener", ["chat-read"], listenerSource),
  fixturePackage("bus-publisher", [], publisherSource),
  fixturePackage("bus-no-chat-read", [], noChatReadSource),
  fixturePackage("bus-lifecycle", [], lifecycleOnlySource),
];
writeFileSync(join(dir, "capability-packages", "installed.json"), JSON.stringify({ schemaVersion: 1, packages }));

const db = await getDB();
const app = Fastify();
app.decorate("db", db);

type Seen = Array<{ type: string; source?: string; chatId?: string; payload: unknown; frozen?: boolean }>;

try {
  for (const id of ["bus-listener", "bus-publisher", "bus-lifecycle"]) {
    assert.equal((await capabilityModuleRuntime.activatePackage(app, id)).readiness, "ready", id);
  }
  const seen = getCapabilityService<Seen>("bus-listener:seen")!;
  const events = getCapabilityService<{
    publish(type: string, payload: unknown, scope?: { chatId?: string }): void;
  }>("bus-publisher:events")!;
  assert.ok(seen && events);
  await delay(20);
  assert.ok(
    seen.some(
      (entry) =>
        entry.type === "engine:package.activated" &&
        (entry.payload as { packageId: string }).packageId === "bus-publisher",
    ),
    "the Engine announces each activation",
  );
  seen.length = 0;

  // ── `engine:` events that carry chat content need chat-read; lifecycle ones do not ──
  await assert.rejects(
    capabilityModuleRuntime.activatePackage(app, "bus-no-chat-read"),
    /must declare the "chat-read" permission to subscribe to engine:agent.result/,
  );

  // ── a package publishes only under its own prefix, JSON only, at most 64 KB ──
  assert.throws(() => events.publish("bus-listener:spoof", {}), /own "bus-publisher:" prefix/);
  assert.throws(() => events.publish("engine:agent.result", {}), /own "bus-publisher:" prefix/);
  assert.throws(() => events.publish("bus-publisher:big", "x".repeat(70 * 1024)), /larger than 65536 bytes/);
  assert.throws(
    () =>
      events.publish(
        "bus-publisher:cyclic",
        (() => {
          const a: Record<string, unknown> = {};
          a.a = a;
          return a;
        })(),
      ),
    /must be JSON/,
  );

  // ── delivery is asynchronous, a copy, frozen, and a handler's own publish is queued after ──
  const payload = { n: 1 };
  const started = Date.now();
  events.publish("bus-publisher:ping", payload);
  assert.equal(seen.length, 0, "the publisher never runs a handler itself");
  assert.ok(Date.now() - started < 100, "a subscriber that never answers does not hold up the publisher");
  payload.n = 2;
  await delay(20);
  assert.deepEqual(seen[0], {
    type: "bus-publisher:ping",
    source: "bus-publisher",
    chatId: undefined,
    payload: { n: 1 },
    frozen: true,
  });
  assert.deepEqual(seen[1], { type: "bus-listener:pong", payload: { inside: 1 } }, "the nested publish came after");

  // ── a chat-scoped event rides that chat's generation stream; an unscoped one does not ──
  const frames: Array<Record<string, unknown>> = [];
  const sink = createGenerationEventSink({ onEvent: (frame) => frames.push(frame), onFinish: () => {} });
  const detach = bus.attachCapabilityEventStream(sink, { chatId: "chat-a", mode: "roleplay" });
  events.publish("bus-publisher:scoped", { hello: "client" }, { chatId: "chat-a" });
  events.publish("bus-publisher:unscoped", { hello: "nobody" });
  events.publish("bus-publisher:other-chat", { hello: "elsewhere" }, { chatId: "chat-b" });
  assert.equal(frames.length, 1);
  assert.equal(frames[0]!.type, "capability_event");
  assert.deepEqual(
    { ...(frames[0]!.data as Record<string, unknown>), at: undefined },
    {
      type: "bus-publisher:scoped",
      source: "bus-publisher",
      chatId: "chat-a",
      payload: { hello: "client" },
      at: undefined,
    },
  );

  // ── Engine agent.result and generation.completed are read from the frames the stream writes ──
  seen.length = 0;
  sendSseEvent(sink, { type: "message_saved", data: { id: "msg-1", role: "assistant" } });
  sendSseEvent(sink, {
    type: "agent_result",
    data: {
      agentType: "character-tracker",
      agentName: "Tracker",
      resultType: "character_tracker_update",
      success: true,
      data: { present: ["a"] },
    },
  });
  sendSseEvent(sink, { type: "done", data: "" });
  await delay(20);
  assert.deepEqual(
    seen.filter((entry) => entry.type.startsWith("engine:")).map((entry) => [entry.type, entry.payload]),
    [
      [
        "engine:agent.result",
        {
          chatId: "chat-a",
          agentType: "character-tracker",
          agentName: "Tracker",
          resultType: "character_tracker_update",
          success: true,
          messageId: null,
          data: { present: ["a"] },
        },
      ],
      ["engine:generation.completed", { chatId: "chat-a", messageId: "msg-1", mode: "roleplay" }],
    ],
  );
  detach();
  events.publish("bus-publisher:scoped", { after: "detach" }, { chatId: "chat-a" });
  assert.equal(frames.filter((frame) => frame.type === "capability_event").length, 1, "a released stream gets nothing");

  // ── chat metadata changes name the keys, never the values ──
  const chats = createChatsStorage(db);
  const chat = (await chats.create({ name: "Bus", mode: "roleplay", characterIds: [], promptPresetId: null }))!;
  await delay(20);
  seen.length = 0;
  await chats.patchMetadata(chat.id, { busProbe: "secret value", untouched: null });
  await chats.patchMetadata(chat.id, { busProbe: "secret value" });
  await delay(20);
  const metadataEvents = seen.filter((entry) => entry.type === "engine:chat.metadata.changed");
  assert.equal(metadataEvents.length, 1, "an unchanged patch publishes nothing");
  assert.deepEqual((metadataEvents[0]!.payload as { keys: string[] }).keys.includes("busProbe"), true);
  assert.ok(!JSON.stringify(metadataEvents[0]!.payload).includes("secret value"));

  // ── nothing is published during a shared-room generation ──
  seen.length = 0;
  const room = {
    roomId: "room",
    epoch: "1",
    operationId: "op",
    chatId: "chat-a",
    characterIds: [],
    characters: [],
    lorebookIds: [],
    participants: [],
    memories: {},
  };
  runWithRoomGeneration(room, () => events.publish("bus-publisher:ping", { room: true }));
  await delay(20);
  assert.equal(seen.length, 0);

  // ── teardown releases the subscriptions ──
  await capabilityModuleRuntime.deactivatePackage("bus-listener");
  assert.equal(bus.hasCapabilityEventSubscribers("bus-publisher:ping"), false);
  events.publish("bus-publisher:ping", { after: "teardown" });
  await delay(20);
  assert.equal(seen.length, 0);
} finally {
  await capabilityModuleRuntime.stop();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("The package event bus delivers asynchronously, guards its namespaces and rides the generation stream.");
