import assert from "node:assert/strict";
import { mock } from "node:test";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-scene-participants-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
const { buildApp } = await import("../../packages/server/src/app.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { resolveConversationPresenceRuntime } =
  await import("../../packages/server/src/routes/generate/conversation-presence-runtime.js");
const { resolveSceneBusyCharacterIds } =
  await import("../../packages/server/src/services/generation/scene-context-runtime.js");
const app = await buildApp();
const requests: Array<{ messages: Array<{ content: string }> }> = [];
const plan = {
  name: "Scene: Library",
  description: "A library.",
  scenario: "Find a book.",
  firstMessage: "Welcome.",
  background: null,
  characterIds: ["not-in-chat"],
  systemPrompt: "Write a scene.",
  rating: "sfw",
  relationshipHistory: "Friends.",
  participationGuide: "Explore the library.",
};
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  requests.push(JSON.parse(Buffer.concat(chunks).toString()));
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) }, finish_reason: "stop" }] }));
});
try {
  await app.ready();
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const api = async (method: "GET" | "POST" | "PATCH", url: string, payload?: object) => {
    const response = await app.inject({ method, url, payload });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  const ids: string[] = [];
  for (const name of ["Alice", "Bob", "Charlie"]) {
    ids.push((await api("POST", "/api/characters", { data: { name } })).id);
  }
  const persona = await api("POST", "/api/characters/personas", { name: "Scene persona", description: "A visitor." });
  const origin = await api("POST", "/api/chats", { name: "Source", mode: "conversation", characterIds: ids });
  const conn = await api("POST", "/api/connections", {
    name: "Scene fixture",
    provider: "custom",
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
  });
  const selected = { participantCharacterIds: ids.slice(0, 2), personaId: persona.id };
  const planned = await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the library",
    promptPreferences: { pov: "third_person", tense: "past", ...selected },
  });
  assert.deepEqual(
    planned.plan.characterIds,
    selected.participantCharacterIds,
    "The model cannot override explicit participants",
  );
  const sent = requests
    .at(-1)!
    .messages.map((m) => m.content)
    .join("\n");
  assert.ok(sent.includes("Scene persona") && sent.includes("Alice") && sent.includes("Bob"));
  assert.ok(!sent.includes("Charlie"), "Excluded character cards are not sent to the planner");
  const payload = {
    originChatId: origin.id,
    connectionId: conn.id,
    plan: planned.plan,
    initiatorCharId: ids[2],
    ...selected,
  };
  const creations = await Promise.all(
    [0, 1].map(() => app.inject({ method: "POST", url: "/api/scene/create", payload })),
  );
  assert.deepEqual(
    creations.map((response) => response.statusCode).sort(),
    [200, 409],
    "Only one active Scene can claim a Conversation",
  );
  const created = creations.find((response) => response.statusCode === 200)!.json();
  const scene = await api("GET", `/api/chats/${created.chatId}`);
  assert.deepEqual(scene.characterIds, selected.participantCharacterIds);
  assert.equal(scene.personaId, persona.id);
  const messages = await api("GET", `/api/chats/${scene.id}/messages`);
  assert.equal(messages.at(-1).characterId, ids[0], "An excluded initiator cannot author the Scene opening");
  const store = createChatsStorage(app.db);
  const chars = createCharactersStorage(app.db);
  const meta = (await api("GET", `/api/chats/${origin.id}`)).metadata;
  assert.deepEqual(meta.sceneBusyCharIds, selected.participantCharacterIds);
  // Earlier versions marked only the initiating character busy. Read the actual Scene roster.
  const legacyMeta = { ...meta, sceneBusyCharIds: [ids[0]] };
  assert.deepEqual(await resolveSceneBusyCharacterIds(store, origin.id, legacyMeta), selected.participantCharacterIds);
  const presenceArgs = {
    db: app.db,
    chatId: origin.id,
    chatMeta: legacyMeta,
    characterIds: ids,
    chats: store,
    chars,
    promptNow: new Date(),
    shouldAccountAutonomousGeneration: false,
    skipPresenceDelay: true,
    supportsHiddenFromAI: false,
    contextMessageLimit: null,
    chatMessages: [],
    finalMessages: [],
    abortSignal: new AbortController().signal,
    writeSse: () => {},
    endSse: () => {},
    mapChatHistoryMessageForPrompt: async () => ({ role: "user" as const, content: "Hello" }),
    resolveHistoryMessageMacros: (messages: any[]) => messages,
  };
  assert.deepEqual((await resolveConversationPresenceRuntime(presenceArgs)).respondingCharacterIds, [ids[2]]);
  assert.equal((await resolveConversationPresenceRuntime({ ...presenceArgs, forCharacterId: ids[0] })).ended, true);
  const before = requests.length;
  for (const invalid of [
    { participantCharacterIds: [] },
    { participantCharacterIds: ["stranger"] },
    { participantCharacterIds: [42] },
    { personaId: "missing" },
    { personaId: 42 },
  ]) {
    for (const url of ["/api/scene/plan", "/api/scene/create"]) {
      const response = await app.inject({
        method: "POST",
        url,
        payload: url.endsWith("plan")
          ? { chatId: origin.id, connectionId: conn.id, promptPreferences: invalid }
          : { ...payload, ...invalid },
      });
      assert.equal(response.statusCode, 400, response.body);
    }
  }
  assert.equal(requests.length, before, "Invalid selections never call the provider");
  await api("POST", "/api/scene/abandon", { sceneChatId: scene.id });
  const restored = (await api("GET", `/api/chats/${origin.id}`)).metadata;
  assert.deepEqual(await resolveSceneBusyCharacterIds(store, origin.id, legacyMeta), []);
  assert.deepEqual(
    (await resolveConversationPresenceRuntime({ ...presenceArgs, chatMeta: restored })).respondingCharacterIds,
    ids,
  );

  // A Scene opened while a Conversation reply waits must suppress that delayed reply.
  mock.timers.enable({ apis: ["setTimeout"] });
  let delayed!: () => void;
  const delayReady = new Promise<void>((resolve) => (delayed = resolve));
  const delayedReply = resolveConversationPresenceRuntime({
    ...presenceArgs,
    chatMeta: restored,
    forCharacterId: ids[0],
    skipPresenceDelay: false,
    chats: {
      ...store,
      resolveConversationPresenceState: async () => ({
        schedules: {},
        statusOverrides: { [ids[0]!]: { status: "idle" as const, createdAt: new Date().toISOString() } },
      }),
    },
    writeSse: (event: any) => {
      if (event.type === "delayed") delayed();
    },
  });
  await delayReady;
  const laterScene = await api("POST", "/api/scene/create", payload);
  mock.timers.tick(15 * 60_000);
  const delayedResult = await delayedReply;
  mock.timers.reset();
  assert.equal(delayedResult.ended, true);
  assert.deepEqual(delayedResult.respondingCharacterIds, []);
  await api("POST", "/api/scene/conclude", { sceneChatId: laterScene.chatId, connectionId: conn.id });
  const returned = await api("GET", `/api/chats/${origin.id}/messages`);
  assert.ok(
    returned.at(-1).content.startsWith("*Scene persona and Alice returned"),
    "The return message uses a participant, not the excluded initiator",
  );

  // Omitted overrides preserve the automatic plan and the source persona.
  await api("PATCH", `/api/chats/${origin.id}`, { personaId: persona.id });
  const automatic = await api("POST", "/api/scene/create", {
    originChatId: origin.id,
    plan: { ...plan, characterIds: [ids[1]] },
    initiatorCharId: ids[1],
  });
  const automaticChat = await api("GET", `/api/chats/${automatic.chatId}`);
  assert.deepEqual(automaticChat.characterIds, [ids[1]]);
  assert.equal(automaticChat.personaId, persona.id);
  await api("POST", "/api/scene/abandon", { sceneChatId: laterScene.chatId });
  const stillActive = await api("GET", `/api/chats/${origin.id}`);
  assert.equal(
    stillActive.metadata.activeSceneChatId,
    automatic.chatId,
    "Cleaning up an older Scene cannot release the active Scene",
  );
  assert.deepEqual(stillActive.metadata.sceneBusyCharIds, [ids[1]]);
  assert.equal(stillActive.connectedChatId, automatic.chatId);
} finally {
  mock.timers.reset();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
