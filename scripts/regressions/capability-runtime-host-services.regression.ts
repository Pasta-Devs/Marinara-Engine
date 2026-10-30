/**
 * Capability API 1.341: `api.runtime` members that let a package server use the Engine's own services instead of a
 * bundled copy. Each one must reach the live host state (one service registry, one command registry, one metadata
 * queue, one admission table, one Intiface client), and each keeps the permission the package declared.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapabilityRuntimeHost } from "../../packages/shared/src/types/capability-runtime.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-runtime-host-services-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = serverRequire("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { logger } = await import("../../packages/server/src/lib/logger.js");
const { inArray } = await import("../../packages/server/src/db/file-query.js");
const { messageSwipes } = await import("../../packages/server/src/db/schema/index.js");
const { capabilityModuleRuntime } =
  await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
const { getCapabilityService, registerCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const { createCapabilityIntegrationHost } =
  await import("../../packages/server/src/services/capability-packages/capability-integrations.service.js");
const { beginForegroundConnection } =
  await import("../../packages/server/src/services/generation/connection-admission.js");
const { hapticService } = await import("../../packages/server/src/services/haptic/buttplug-service.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGalleryStorage } = await import("../../packages/server/src/services/storage/gallery.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema } = await import("../../packages/shared/src/schemas/character.schema.js");
const { createCharacterGalleryStorage } =
  await import("../../packages/server/src/services/storage/character-gallery.storage.js");
const { supportedCapabilityApi } = await import("../../packages/shared/src/schemas/capability-package.schema.js");

assert.ok(
  supportedCapabilityApi.major === 1 && supportedCapabilityApi.minor >= 341,
  "the new members ship as capability API 1.341",
);

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const timestamp = new Date().toISOString();
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
async function withinDeadline<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function fixturePackage(id: string, permissions: string[], source: string) {
  const manifest = {
    schemaVersion: 1,
    id,
    name: id,
    version: "1.0.0",
    description: "Local runtime host services proof",
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
}
const fullSource = `export function activate(context) {
  context.api.registerService("host-services-full:runtime", context.api.runtime);
  context.api.registerService("host-services-full:value", { answer: 42 });
  context.api.registerService("host-services-full:hidden", { secret: 1 }, { hostOnly: true });
  context.api.registerConversationCommand({
    commandType: "probe",
    tags: ["probe"],
    description: "Probe the host.",
    payloadExample: '{"a":1}',
    handler() {},
  });
}
`;
const readerSource = `export function activate(context) {
  context.api.registerService("host-services-reader:runtime", context.api.runtime);
}
`;
const packages = [
  fixturePackage(
    "host-services-full",
    ["chat-read", "chat-write", "conversation-actions", "network", "storage"],
    fullSource,
  ),
  fixturePackage("host-services-reader", ["chat-read"], readerSource),
];
writeFileSync(join(dir, "capability-packages", "installed.json"), JSON.stringify({ schemaVersion: 1, packages }));

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
const hostChats = createChatsStorage(db);

try {
  for (const { id } of packages) {
    assert.equal((await capabilityModuleRuntime.activatePackage(app, id)).readiness, "ready", id);
  }
  const full = getCapabilityService<CapabilityRuntimeHost>("host-services-full:runtime");
  const reader = getCapabilityService<CapabilityRuntimeHost>("host-services-reader:runtime");
  assert.ok(full && reader);

  // ── services.get reads the host registry, across packages ──
  assert.deepEqual(full.services?.get("host-services-full:value"), { answer: 42 });
  assert.equal(
    reader.services?.get("host-services-full:value"),
    full.services?.get("host-services-full:value"),
    "another package sees the very object the first one registered",
  );
  assert.equal(reader.services?.get("host-services-missing"), null);
  // Agent runtime hooks and Mari actions stay host-only: no package reads them, not even the one that owns them.
  for (const key of ["agent-runtime:host-services-full", "mari-actions:host-services-full"]) {
    const release = registerCapabilityService(key, { hook: "host only" });
    try {
      assert.deepEqual(getCapabilityService(key), { hook: "host only" }, key);
      assert.equal(reader.services?.get(key), null, key);
      assert.equal(full.services?.get(key), null, key);
    } finally {
      release();
    }
  }
  // A service registered with `hostOnly` stays readable by the Engine, but no package reads it, not even its owner.
  assert.deepEqual(getCapabilityService("host-services-full:hidden"), { secret: 1 });
  assert.equal(reader.services?.get("host-services-full:hidden"), null);
  assert.equal(full.services?.get("host-services-full:hidden"), null);
  // The flag belongs to one registration: releasing the service clears it, so the same key without the flag is visible.
  const releaseHidden = registerCapabilityService("host-services-flag:key", { n: 1 }, { hostOnly: true });
  assert.equal(reader.services?.get("host-services-flag:key"), null);
  releaseHidden();
  const releaseOpen = registerCapabilityService("host-services-flag:key", { n: 2 });
  try {
    assert.deepEqual(reader.services?.get("host-services-flag:key"), { n: 2 });
  } finally {
    releaseOpen();
  }

  // ── commands use the host grammar and every package's registered tags ──
  const reply = 'Sure [probe:{"a":1}] and [unknown:x] done';
  assert.deepEqual(reader.commands?.parse(reply), [{ type: "capability", commandType: "probe", payload: '{"a":1}' }]);
  assert.equal(reader.commands?.strip(reply), "Sure  and [unknown:x] done");
  assert.ok(
    reader.commands?.instructions().includes('- [probe:<JSON payload>] — Probe the host. Example: [probe:{"a":1}]'),
  );

  // ── logger.isLevelEnabled follows the live Engine logger ──
  const previousLevel = logger.level;
  try {
    logger.level = "info";
    assert.equal(full.logger.isLevelEnabled?.("info"), true);
    assert.equal(full.logger.isLevelEnabled?.("debug"), false);
    logger.level = "debug";
    assert.equal(full.logger.isLevelEnabled?.("debug"), true);
  } finally {
    logger.level = previousLevel;
  }

  // ── persistence.patchChatMetadata shares the host's metadata queue ──
  const chat = (await hostChats.create({
    name: "Runtime host services",
    mode: "conversation",
    characterIds: [],
    promptPresetId: null,
  }))!;
  const readMetadata = async () => JSON.parse((await hostChats.getById(chat.id))!.metadata as string);
  const increment = (key: string) => async (current: Record<string, unknown>) => {
    await delay(2);
    return { [key]: ((current[key] as number | undefined) ?? 0) + 1 };
  };
  await Promise.all(
    Array.from({ length: 5 }, () => [
      full.persistence.patchChatMetadata!(chat.id, increment("packageCount")),
      hostChats.patchMetadata(chat.id, increment("hostCount")),
    ]).flat(),
  );
  await Promise.all([
    full.persistence.patchChatMetadata!(chat.id, { characterSchedules: { a: "package" } }),
    hostChats.patchMetadata(chat.id, { hostSetting: "host" }),
  ]);
  let metadata = await readMetadata();
  assert.equal(metadata.packageCount, 5, "package patches queue behind each other");
  assert.equal(metadata.hostCount, 5, "host patches made at the same time all survive");
  assert.deepEqual(metadata.characterSchedules, { a: "package" });
  assert.equal(metadata.hostSetting, "host");
  assert.equal(
    typeof metadata.metadataWriteOrdinals?.characterSchedules,
    "number",
    "a package patch is ordinal-stamped",
  );

  // Inside the package's own lock for the chat, the patch runs within it instead of waiting for it forever.
  assert.equal(
    await withinDeadline(
      full.persistence.withChatLock(chat.id, async () => {
        await full.persistence.patchChatMetadata!(chat.id, { insideLock: true });
        return "done";
      }),
      "patchChatMetadata inside withChatLock for the same chat must not wait for its own lock",
    ),
    "done",
  );
  // A patch from outside the lock still waits for it.
  let releaseLock!: () => void;
  const lockGate = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const held = full.persistence.withChatLock(chat.id, () => lockGate);
  await tick();
  const outside = full.persistence.patchChatMetadata!(chat.id, { outsideLock: true });
  await delay(20);
  assert.equal((await readMetadata()).outsideLock, undefined, "a patch from outside the lock waits for it");
  releaseLock();
  await held;
  await outside;
  metadata = await readMetadata();
  assert.equal(metadata.insideLock, true);
  assert.equal(metadata.outsideLock, true);

  const updatedAt = (await hostChats.getById(chat.id))!.updatedAt;
  await delay(5);
  await full.persistence.patchChatMetadata!(chat.id, { quiet: true }, { touchUpdatedAt: false });
  assert.equal((await hostChats.getById(chat.id))!.updatedAt, updatedAt, "touchUpdatedAt false keeps updatedAt");

  // Like updateChatMetadata, a patch cannot add a reference to a Global Gallery image that does not exist.
  await assert.rejects(
    () => full.persistence.patchChatMetadata!(chat.id, { cover: "global-gallery:missing-image" }),
    (error: Error) => error.name === "GlobalGalleryCapabilityReferenceUnavailableError",
  );
  assert.equal((await readMetadata()).cover, undefined);

  // ── appendMessages, createChatNote and createChatInfluence write through host storage ──
  const appended = await full.persistence.appendMessages!(chat.id, [
    { role: "user", characterId: null, content: "Hello from the call" },
    { role: "assistant", characterId: null, content: "Hi there", extra: { callId: "call-1" } },
  ]);
  assert.deepEqual(
    appended.map((message) => [message.chatId, message.role, message.content]),
    [
      [chat.id, "user", "Hello from the call"],
      [chat.id, "assistant", "Hi there"],
    ],
  );
  assert.deepEqual(
    (await full.persistence.listMessages(chat.id)).map((message) => message.id),
    appended.map((message) => message.id),
  );
  const swipes = await db
    .select()
    .from(messageSwipes)
    .where(
      inArray(
        messageSwipes.messageId,
        appended.map((message) => message.id),
      ),
    );
  assert.equal(swipes.length, 2, "each appended message has its first swipe");
  await assert.rejects(
    () => full.persistence.appendMessages!("missing-chat", [{ role: "user", characterId: null, content: "lost" }]),
    /was not found/,
  );

  const roleplay = (await hostChats.create({
    name: "Connected roleplay",
    mode: "roleplay",
    characterIds: [],
    promptPresetId: null,
  }))!;
  await full.persistence.createChatNote!(chat.id, roleplay.id, "Remember the call", appended[1]!.id);
  await full.persistence.createChatInfluence!(chat.id, roleplay.id, "She sounded worried");
  assert.deepEqual(
    (await hostChats.listNotes(roleplay.id)).map((note) => [note.sourceChatId, note.content, note.anchorMessageId]),
    [[chat.id, "Remember the call", appended[1]!.id]],
  );
  assert.deepEqual(
    (await hostChats.listPendingInfluences(roleplay.id)).map((influence) => influence.content),
    ["She sounded worried"],
  );

  // Without chat-write, every new writer refuses before touching storage.
  const before = await readMetadata();
  await assert.rejects(() => reader.persistence.patchChatMetadata!(chat.id, { denied: true }), /requires chat-write/);
  await assert.rejects(
    () => reader.persistence.appendMessages!(chat.id, [{ role: "user", characterId: null, content: "denied" }]),
    /requires chat-write/,
  );
  await assert.rejects(() => reader.persistence.createChatNote!(chat.id, roleplay.id, "denied"), /requires chat-write/);
  await assert.rejects(
    () => reader.persistence.createChatInfluence!(chat.id, roleplay.id, "denied"),
    /requires chat-write/,
  );
  assert.deepEqual(await readMetadata(), before);
  assert.equal((await full.persistence.listMessages(chat.id)).length, 2);
  assert.equal((await hostChats.listNotes(roleplay.id)).length, 1);
  assert.equal((await hostChats.listPendingInfluences(roleplay.id)).length, 1);

  // ── persistence.setMessagesHiddenFromAI (1.389) flips hiddenFromAI through host storage ──
  const hideChat = (await hostChats.create({
    name: "Hide from the AI",
    mode: "conversation",
    characterIds: [],
    promptPresetId: null,
  }))!;
  const [plain, swiped, alreadyHidden, setByHand] = await full.persistence.appendMessages!(hideChat.id, [
    { role: "user", characterId: null, content: "plain" },
    { role: "assistant", characterId: null, content: "swiped" },
    { role: "assistant", characterId: null, content: "already hidden", extra: { hiddenFromAI: true } },
    { role: "assistant", characterId: null, content: "set by hand", extra: { visibilityManual: true } },
  ]);
  await hostChats.addSwipe(swiped!.id, "second swipe", true);
  const [otherChatMessage] = await full.persistence.appendMessages!(chat.id, [
    { role: "user", characterId: null, content: "another chat" },
  ]);
  const hideIds = [plain!.id, swiped!.id, alreadyHidden!.id, setByHand!.id, otherChatMessage!.id];
  const hiddenFlags = async (ids: string[]) =>
    (await Promise.all(ids.map((id) => hostChats.getMessage(id)))).map(
      (message) => JSON.parse(message!.extra as string).hiddenFromAI === true,
    );

  await assert.rejects(
    () => reader.persistence.setMessagesHiddenFromAI!(hideChat.id, hideIds, true),
    /requires chat-write/,
    "chat-read alone cannot hide messages",
  );
  assert.deepEqual(await hiddenFlags(hideIds), [false, false, true, false, false]);
  await assert.rejects(() => full.persistence.setMessagesHiddenFromAI!("missing-chat", hideIds, true), /was not found/);

  assert.deepEqual(
    (await full.persistence.setMessagesHiddenFromAI!(hideChat.id, hideIds, true)).sort(),
    [plain!.id, swiped!.id].sort(),
    "only the ids this call flipped come back: not the hidden one, the manual one or another chat's",
  );
  assert.deepEqual(await hiddenFlags(hideIds), [true, true, true, false, false]);
  assert.deepEqual(
    (await hostChats.getSwipes(swiped!.id)).map((swipe) => JSON.parse(swipe.extra as string).hiddenFromAI),
    [true, true],
    "every swipe is hidden with its message",
  );
  assert.equal(JSON.parse((await hostChats.getMessage(plain!.id))!.extra as string).visibilityManual, undefined);
  assert.deepEqual(await full.persistence.setMessagesHiddenFromAI!(hideChat.id, hideIds, true), []);

  assert.deepEqual(
    (await full.persistence.setMessagesHiddenFromAI!(hideChat.id, [plain!.id, setByHand!.id], false)).sort(),
    [plain!.id],
    "showing returns only the ids that changed back",
  );
  assert.deepEqual(await hiddenFlags(hideIds), [false, true, true, false, false]);

  // ── persistence.updateCharacterStatus is the host's [schedule_update]: a status on the character card ──
  const characters = createCharactersStorage(db);
  const alice = (await characters.create(characterDataSchema.parse({ name: "Alice" })))!;
  const outsider = (await characters.create(characterDataSchema.parse({ name: "Outsider" })))!;
  const statusChat = (await hostChats.create({
    name: "Status from a call",
    mode: "conversation",
    characterIds: [alice.id],
    promptPresetId: null,
  }))!;
  const cardOverride = async (characterId: string) =>
    JSON.parse((await characters.getById(characterId))!.data as string).extensions?.conversationStatusOverride;
  const startedAt = Date.now();
  const status = await full.persistence.updateCharacterStatus!(statusChat.id, alice.id, {
    status: "dnd",
    activity: "  Gaming with friends ",
    duration: "2h",
  });
  assert.equal(status?.status, "dnd");
  assert.equal(status?.activity, "Gaming with friends");
  const expiresIn = Date.parse(status!.expiresAt) - startedAt;
  assert.ok(expiresIn >= 2 * 3_600_000 - 1_000 && expiresIn <= 2 * 3_600_000 + 5_000, "the duration sets the end");
  assert.deepEqual(
    { ...(await cardOverride(alice.id)), createdAt: undefined },
    { status: "dnd", activity: "Gaming with friends", expiresAt: status!.expiresAt, createdAt: undefined },
    "the card carries the status",
  );
  // The chat's cached presence is refreshed from the card, so the next read keeps the status instead of wiping it.
  assert.equal(
    (await hostChats.resolveConversationPresenceState(statusChat.id)).statusOverrides[alice.id]?.status,
    "dnd",
  );
  assert.equal(
    (await full.persistence.updateCharacterStatus!(statusChat.id, alice.id, { activity: "Making tea", duration: "??" }))
      ?.status,
    "dnd",
    "an activity alone keeps the current status",
  );

  // A status the user set by hand (no end time) stays in charge.
  const manual = { status: "offline", activity: "Away", createdAt: timestamp, expiresAt: null };
  await characters.update(alice.id, { extensions: { conversationStatusOverride: manual } }, undefined, {
    skipVersionSnapshot: true,
  });
  assert.equal(await full.persistence.updateCharacterStatus!(statusChat.id, alice.id, { status: "online" }), null);
  assert.deepEqual(await cardOverride(alice.id), manual);

  // It reaches only a character of a Conversation chat, with a valid update, and needs chat-write.
  const refused: Array<[string, string, unknown, RegExp]> = [
    [statusChat.id, alice.id, { status: "busy" }, /status must be/],
    [statusChat.id, alice.id, { status: "dnd", activity: 5 }, /activity must be text/],
    [statusChat.id, alice.id, { activity: "x".repeat(501) }, /at most 500 characters/],
    [statusChat.id, alice.id, { activity: "   " }, /needs a status or an activity/],
    [statusChat.id, alice.id, null, /needs an update object/],
    [statusChat.id, outsider.id, { status: "dnd" }, /is not in chat/],
    [roleplay.id, alice.id, { status: "dnd" }, /is not a Conversation chat/],
    ["missing-chat", alice.id, { status: "dnd" }, /was not found/],
  ];
  for (const [chatId, characterId, update, reason] of refused) {
    await assert.rejects(
      () => full.persistence.updateCharacterStatus!(chatId, characterId, update as never),
      reason,
      String(reason),
    );
  }
  await assert.rejects(
    () => reader.persistence.updateCharacterStatus!(statusChat.id, alice.id, { status: "dnd" }),
    /requires chat-write/,
  );
  assert.deepEqual(await cardOverride(outsider.id), undefined);
  assert.deepEqual(await cardOverride(alice.id), manual, "a refused update changes nothing");

  // A shared room keeps its own routines and never writes the character card.
  await characters.update(alice.id, { extensions: { conversationStatusOverride: null } }, undefined, {
    skipVersionSnapshot: true,
  });
  await full.persistence.updateChatMetadata({
    chatId: statusChat.id,
    metadata: { multiplayerSetup: true },
    updatedAt: new Date().toISOString(),
  });
  assert.equal(await full.persistence.updateCharacterStatus!(statusChat.id, alice.id, { status: "dnd" }), null);
  assert.equal(await cardOverride(alice.id), null);

  // ── admission uses the host's admission table ──
  const admission = full.integrations.admission!;
  const foreign = createCapabilityIntegrationHost(["network"]).llm.createProvider(
    "openai",
    "http://127.0.0.1:9/v1",
    "k",
  );
  assert.throws(() => admission.withProvider(foreign, "conn-a"), /created by this package's host integrations/);
  const own = full.integrations.llm.createProvider("openai", "http://127.0.0.1:9/v1", "k");
  const admitted = admission.withProvider(own, "conn-a", { kind: "background" });
  assert.equal(typeof admitted.chat, "function");
  assert.notEqual(admitted, own);

  let finishForeground!: () => void;
  const foreground = admission.run(
    "conn-busy",
    { kind: "foreground" },
    () =>
      new Promise<void>((resolve) => {
        finishForeground = resolve;
      }),
  );
  await tick();
  assert.deepEqual(admission.tryBackground("conn-busy"), { acquired: false }, "busy while a foreground attempt runs");
  let busyError: unknown;
  await assert.rejects(
    () => admission.run("conn-busy", { kind: "background" }, async () => "never"),
    (error) => {
      busyError = error;
      return true;
    },
  );
  assert.equal(admission.isFailure(busyError), true);
  assert.equal(admission.isFailure(new Error("provider failed")), false);
  finishForeground();
  await foreground;
  const later = admission.tryBackground("conn-busy", new Date(Date.now() + 60_000));
  assert.equal(later.acquired, true, "free once the user's request ended and the idle window passed");
  if (later.acquired) later.release("completed");
  // An Engine foreground request, started outside any package, is seen by the package too.
  const releaseHost = beginForegroundConnection("conn-host");
  assert.deepEqual(admission.tryBackground("conn-host", new Date(Date.now() + 60_000)), { acquired: false });
  releaseHost("completed");

  // ── haptics, Spotify and local speech are the host's, and need network ──
  assert.deepEqual(full.integrations.haptics?.status(), hapticService.status());
  assert.equal(await full.integrations.spotify?.commandsAvailable(), false, "no Music DJ agent is set up");
  await assert.rejects(
    () => full.integrations.spotify!.playSong({ title: "Song", artist: "Artist" }),
    (error: Error & { code?: string }) =>
      error.name === "ConversationSpotifyCommandError" && error.code === "spotify_unavailable",
  );
  await assert.rejects(
    () => full.integrations.speech!.transcribeLocal!(new Uint8Array(44)),
    /Download Local Whisper from Connections/,
  );
  assert.throws(() => reader.integrations.haptics!.status(), /network permission/);
  assert.throws(() => reader.integrations.haptics!.connect(), /network permission/);
  assert.throws(
    () => reader.integrations.haptics!.executeCommand({ deviceIndex: "all", action: "stop" }),
    /network permission/,
  );
  assert.throws(() => reader.integrations.spotify!.commandsAvailable(), /network permission/);
  assert.throws(() => reader.integrations.spotify!.playSong({ title: "Song", artist: "Artist" }), /network permission/);
  assert.throws(() => reader.integrations.speech!.transcribeLocal!(new Uint8Array(44)), /network permission/);

  // ── chat and entity galleries, behind storage ──
  const gallery = {
    prompt: "A selfie",
    provider: "probe",
    model: "probe-model",
    width: 1,
    height: 1,
  };
  const filePath = full.integrations.images.save(chat.id, png, "png");
  const added = await full.integrations.images.addToChatGallery!({ chatId: chat.id, filePath, ...gallery });
  assert.deepEqual(
    (await createGalleryStorage(db).listByChatId(chat.id)).map((row) => [row.id, row.filePath]),
    [[added.id, filePath]],
  );
  await assert.rejects(
    () => full.integrations.images.addToChatGallery!({ chatId: chat.id, filePath: "../outside.png", ...gallery }),
    /saved with images\.save/,
  );
  await assert.rejects(
    () => full.integrations.images.addToChatGallery!({ chatId: chat.id, filePath: `${chat.id}/gone.png`, ...gallery }),
    /saved with images\.save/,
  );
  assert.deepEqual(
    await full.integrations.images.persistToEntityGalleries!({
      sourceFilePath: filePath,
      sourceChatImageId: added.id,
      characterIds: ["character-probe"],
      ...gallery,
    }),
    { characterCount: 1, personaCount: 0 },
  );
  assert.deepEqual(
    (await createCharacterGalleryStorage(db).listByCharacterId("character-probe")).map((row) => [
      row.filePath,
      row.sourceChatImageId,
    ]),
    [[filePath, added.id]],
  );
  assert.deepEqual(
    await full.integrations.images.persistToEntityGalleries!({
      sourceFilePath: filePath,
      characterIds: ["character-probe"],
      enabled: false,
      ...gallery,
    }),
    { characterCount: 0, personaCount: 0 },
  );
  assert.throws(
    () => reader.integrations.images.addToChatGallery!({ chatId: chat.id, filePath, ...gallery }),
    /storage permission/,
  );
  assert.throws(
    () => reader.integrations.images.persistToEntityGalleries!({ sourceFilePath: filePath, ...gallery }),
    /storage permission/,
  );
  assert.equal((await createGalleryStorage(db).listByChatId(chat.id)).length, 1);

  // ── Once the registering package is gone, its service and commands are gone for everyone ──
  await capabilityModuleRuntime.deactivatePackage("host-services-full");
  assert.equal(reader.services?.get("host-services-full:value"), null);
  assert.deepEqual(reader.commands?.parse(reply), []);
  assert.equal(reader.commands?.strip(reply), reply);
} finally {
  await capabilityModuleRuntime.stop();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Package servers reach the Engine's services, commands, logger, chat writes, character status, admission, haptics, Spotify, local speech and galleries.",
);
