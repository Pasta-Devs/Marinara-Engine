import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

// A long Game session resent every message every turn. Advanced Memory now runs in Game chats too: the GM
// reads the memory alone, as its narrator, and the summary and recalled scenes sit after the history, just
// before the turn reminder, so they never break the provider's cache of the history in front of them.

const directory = mkdtempSync(join(tmpdir(), "marinara-advanced-memory-game-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

const helperTexts: string[] = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as {
    input?: string | string[];
    messages?: Array<{ content: string }>;
  };
  response.setHeader("Content-Type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    const input = Array.isArray(body.input) ? body.input : [body.input ?? ""];
    response.end(JSON.stringify({ data: input.map((_text, index) => ({ index, embedding: [1, 0, 0.5] })) }));
    return;
  }
  const messages = body.messages ?? [];
  const text = messages.map((message) => message.content).join("\n");
  helperTexts.push(text);
  const classification = messages[0]?.content.startsWith("Identify scene transitions") === true;
  let content: string;
  if (classification) {
    const source = JSON.parse(messages[1]!.content) as Array<{
      messageId: string;
      messageNumber: number;
      content: string;
    }>;
    const transitions = source.filter((message) => message.content.includes("SCENE_CHANGE"));
    content = JSON.stringify(
      messages[0]!.content.includes('"ends"')
        ? { ends: transitions.map((message) => ({ messageNumber: message.messageNumber - 1 })) }
        : { starts: transitions.map((message) => ({ messageId: message.messageId })) },
    );
  } else {
    content = JSON.stringify({ audience: "all", summary: "The party crossed the harbour.", title: "Harbour" });
  }
  response.end(
    JSON.stringify({
      id: "game-memory",
      object: "chat.completion",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}/v1`;

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const {
  createAdvancedMemoryService,
  effectiveAdvancedMemorySettings,
  gameAdvancedMemorySource,
  GAME_MASTER_MEMORY_READER_ID,
  withoutSessionAdvancedMemory,
} = await import("../../packages/server/src/services/advanced-memory.js");
const { createConnectionSchema } = await import("../../packages/shared/src/schemas/connection.schema.ts");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS } = await import("../../packages/shared/src/types/advanced-memory.ts");

try {
  // The per-character settings never apply to a Game chat; Roleplay keeps its own.
  const saved = {
    ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
    enabled: true,
    decisionEnabled: true,
    narratorCharacterId: "party-member",
    characterRecollections: true,
    autoMessageVisibility: true,
    knowledgeStarts: { "party-member": "m1" },
  };
  const game = effectiveAdvancedMemorySettings("game", saved);
  assert.equal(game.narratorCharacterId, GAME_MASTER_MEMORY_READER_ID, "the GM reads Game memory as its narrator");
  assert.equal(game.characterRecollections, false);
  assert.equal(game.autoMessageVisibility, false);
  assert.deepEqual(game.knowledgeStarts, {});
  assert.equal(game.decisionEnabled, true, "the Decision model stays the player's opt-in");
  assert.equal(effectiveAdvancedMemorySettings("roleplay", saved), saved, "Roleplay settings are unchanged");
  assert.equal(DEFAULT_ADVANCED_MEMORY_SETTINGS.decisionEnabled, false, "the Decision model starts off");

  // Memory reads the story the player sees: segment edits applied, GM command tags removed.
  const shaped = gameAdvancedMemorySource(
    [
      { id: "u1", role: "user", content: "I walk to the docks. [music: battle]" },
      { id: "a1", role: "assistant", content: "The tide is out.\n\n[music: harbour]\n\nGulls circle the masts." },
      { id: "a2", role: "assistant", content: "A spoiler the player cut." },
    ],
    { "segmentEdit:a1:1": { content: "Crows circle the masts." }, "segmentDelete:a2:0": true },
  );
  assert.deepEqual(
    shaped.map((message) => message.id),
    ["u1", "a1"],
    "a reply whose every segment was deleted leaves memory too",
  );
  assert.equal(shaped[0]!.content, "I walk to the docks. [music: battle]", "the player's own text is untouched");
  assert(!shaped[1]!.content.includes("[music:"), "GM command tags never reach the helper");
  assert(shaped[1]!.content.includes("Crows circle the masts."), "the player's segment edit is what memory reads");

  const db = await createFileNativeDB();
  const chats = createChatsStorage(db);
  const memory = createAdvancedMemoryService(db);
  const connection = await createConnectionsStorage(db).create(
    createConnectionSchema.parse({
      name: "Game memory",
      provider: "openai",
      model: "gpt-4o-mini",
      baseUrl,
      apiKey: "test-key",
      maxContext: 16_384,
      defaultForAgents: true,
      embeddingBaseUrl: baseUrl,
      embeddingModel: "game-memory",
      treatAsLocalEndpoint: true,
    }),
  );
  const chat = await chats.create({
    name: "Saltmere, session 3",
    mode: "game",
    characterIds: [],
    connectionId: connection!.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, { summaryMaxTokens: 512 });

  // A Game chat saves Advanced Memory settings; a narrator saved there is ignored, not refused.
  const status = await memory.updateSettings(
    chat.id,
    { enabled: true, maxContextTokens: 16_384, summaryBudgetTokens: 512, narratorCharacterId: "nobody" },
    { startRecollections: false },
  );
  assert.equal(status.settings.enabled, true);
  assert.equal(status.settings.narratorCharacterId, GAME_MASTER_MEMORY_READER_ID);
  assert.deepEqual(status.missingKnowledgeCharacterIds, [], "a Game chat never waits on knowledge ranges");

  await chats.createMessagesBatch(chat.id, [
    ...Array.from({ length: 80 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content:
        index % 2
          ? `${index === 40 ? "SCENE_CHANGE " : ""}Turn ${index}: the GM narrates the harbour. [music: harbour]`
          : `Turn ${index}: I search the crates.`,
    })),
    {
      role: "system" as const,
      content: "[Checkpoint restored: Before the storm]",
      extra: { gameStateAnchor: "checkpoint_restore", checkpointId: "cp-1" },
    },
    { role: "user" as const, content: "Turn 81: I look for Mira." },
  ]);
  await memory.initialize(chat.id);
  assert.equal((await memory.status(chat.id)).job.status, "ready");
  assert(
    helperTexts.length > 0 && helperTexts.every((text) => !text.includes("[music:")),
    "the helper reads Game history without GM command tags",
  );

  const stored = await chats.listMessages(chat.id);
  const source = gameAdvancedMemorySource(stored, (await chats.getById(chat.id))!.metadata as Record<string, unknown>);
  const prepared = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: [GAME_MASTER_MEMORY_READER_ID],
    budgetTokens: 900,
  });
  assert(prepared.messageIds.includes(stored.at(-1)!.id), "the latest turn stays exact history");
  assert(prepared.messageIds.length < stored.length, "a long session is held to the cap, not sent whole");
  const restore = stored.find((message) => message.role === "system")!;
  assert(prepared.messageIds.includes(restore.id), "a checkpoint restore note inside the window stays in the history");
  await memory.validatePrepared(chat.id, source, prepared.receipt);
  await assert.rejects(
    memory.validatePrepared(chat.id, stored, prepared.receipt),
    "the generate route must hand memory the same shaped Game history",
  );
} finally {
  server.close();
  rmSync(directory, { recursive: true, force: true });
}

// The generate route places Game memory after the history, before the turn reminder, and lets the GM read it.
const generate = readFileSync(new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url), "utf8");
assert.match(
  generate,
  /advancedMemoryEnabled && !presetPlacedAdvancedMemory && chatMode !== "game"/,
  "Game memory is never spliced in front of the history",
);
const reminderPush = generate.indexOf('finalMessages.push({ role: "user" as const, content: formatReminder });');
const memoryPush = generate.lastIndexOf("...advancedMemoryPlacements.map(", reminderPush);
assert(memoryPush > 0 && reminderPush - memoryPush < 400, "Game memory goes in just before the turn reminder");
assert.match(generate, /chatMode === "game" && !input\.impersonate \? \[GAME_MASTER_MEMORY_READER_ID\]/);
assert.match(generate, /\(chatMode === "roleplay" \|\| chatMode === "game"\) && advancedMemorySettings\.enabled/);

// A new session starts its own memory: the progress is left behind, the settings carry over.
const gameRoutes = readFileSync(new URL("../../packages/server/src/routes/game.routes.ts", import.meta.url), "utf8");
assert.match(gameRoutes, /const carryMeta = withoutSessionAdvancedMemory\(previousSessionMeta\);/);
const carried = withoutSessionAdvancedMemory({
  advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true },
  advancedMemoryState: { resetRevision: "old", contextStarts: { gm: "old-message" } },
  summaryEntries: [
    {
      id: "auto",
      kind: "rolling",
      origin: "automated",
      title: "Messages #1-#40",
      content: "Old recap.",
      enabled: true,
      sourceMode: "range",
      messageIds: ["old-1"],
    },
    {
      id: "mine",
      kind: "rolling",
      origin: "manual",
      title: "Notes",
      content: "Mira owes us.",
      enabled: true,
      sourceMode: "last",
    },
    {
      id: "agent",
      kind: "rolling",
      origin: "automated",
      title: "Chat Summary agent",
      content: "The agent's recap.",
      enabled: false,
      sourceMode: "agent",
    },
  ],
  summary: "Old recap.\n\nMira owes us.",
  gameId: "saltmere",
});
assert.equal((carried.advancedMemory as { enabled: boolean }).enabled, true, "the settings carry over");
assert.equal(carried.advancedMemoryState, undefined, "the old session's progress does not");
assert.deepEqual(
  (carried.summaryEntries as Array<{ id: string }>).map((entry) => entry.id).sort(),
  ["agent", "mine"],
  "Advanced Memory's recaps of the old session's messages stay behind; the player's and the agent's carry over",
);
assert.equal(carried.summary, "Mira owes us.");
assert.equal(carried.gameId, "saltmere");
assert.deepEqual(withoutSessionAdvancedMemory({ gameId: "x", advancedMemoryState: {} }), { gameId: "x" });

// Every settings read in the memory service sees the GM as the reader, or a Game chat's policy check never
// matches the settings it was prepared with.
const service = readFileSync(new URL("../../packages/server/src/services/advanced-memory.ts", import.meta.url), "utf8");
assert.doesNotMatch(service, /settings: normalizeAdvancedMemorySettings\(/);

// The Game drawer shows Advanced Memory without the per-character controls.
const drawer = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatSettingsDrawer.tsx", import.meta.url),
  "utf8",
);
assert.match(drawer, /const advancedMemoryAvailable = isRoleplayMode \|\| isGame;/);
assert.match(drawer, /gameMode=\{isGame\}/);
const settingsPanel = readFileSync(
  new URL("../../packages/client/src/components/chat/AdvancedMemorySettings.tsx", import.meta.url),
  "utf8",
);
assert.match(
  settingsPanel,
  /\{!gameMode && \(\s*<SettingsSwitch\s*label=\{t\("chat\.advancedMemory\.characterRecollections"\)\}/,
);

console.log("advanced-memory-game regression passed");
