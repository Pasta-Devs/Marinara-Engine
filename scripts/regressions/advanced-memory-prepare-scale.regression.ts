import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #7702: preparing a reply checked every stored memory against a fresh scan of the whole chat, so at 800 scenes
// it took seconds before the first token. Each message's details are now read a fixed number of times per reply,
// however many scenes the archive holds.
const directory = mkdtempSync(join(tmpdir(), "marinara-prepare-scale-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url === "/v1/systemone") {
    const answers = Object.fromEntries(
      Object.entries(body.questions).map(([id, value]) => {
        const message = body.state.transcript?.find((item: { messageId: string }) => item.messageId === id);
        const cut = (value as { instructions: string }).instructions.includes("cut to a new scene");
        return [id, { type: "noul", noul: cut && message?.content.startsWith("SCENE_CHANGE") ? 0.99 : 0.01 }];
      }),
    );
    response.end(JSON.stringify({ answers }));
    return;
  }
  response.end(
    JSON.stringify({
      choices: [
        {
          message: {
            role: "assistant",
            content: JSON.stringify({ audience: "all", summary: "Mari and Kaito talked about work." }),
          },
          finish_reason: "stop",
        },
      ],
    }),
  );
});

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const memory = createAdvancedMemoryService(db);

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const helper = await connections.create({
    name: "Summary helper",
    provider: "custom",
    baseUrl: `${base}/v1`,
    model: "summary",
    apiKey: "fixture",
    maxContext: 65000,
  });
  const decision = await connections.create({
    name: "Jev",
    provider: "decision",
    decisionSource: "custom",
    baseUrl: base,
    model: "jev-latest",
    apiKey: "",
    maxStateTokens: 30000,
  });

  /** How often one prepare reads a message's details, per message, in a chat with this many past scenes. */
  const readsPerMessage = async (scenes: number) => {
    const chat = await chats.create({
      name: `${scenes} scenes`,
      mode: "roleplay",
      characterIds: ["kaito"],
      connectionId: helper.id,
    });
    assert(chat);
    await memory.updateSettings(chat.id, {
      enabled: true,
      decisionEnabled: true,
      decisionConnectionId: decision.id,
      knowledgeStarts: { kaito: null },
      knowledgeConfirmed: true,
    });
    await chats.createMessagesBatch(chat.id, [
      ...Array.from({ length: scenes }, (_, index) => [
        { role: "user" as const, content: `SCENE_CHANGE Mari and Kaito meet at home on day ${index}.` },
        { role: "assistant" as const, characterId: "kaito", content: `Kaito tells Mari about day ${index} at work.` },
        { role: "user" as const, content: "Mari thanks Kaito, and they talk for a while." },
      ]).flat(),
      { role: "user", content: "SCENE_CHANGE Mari comes home late.", extra: { isConversationStart: true } },
      { role: "assistant", characterId: "kaito", content: "Kaito waves from the kitchen." },
      { role: "user", content: "Kaito, what did you tell me about work?" },
    ]);
    await memory.initialize(chat.id);
    const summarized = (await memory.status(chat.id)).records.filter(
      (record) => record.kind === "scene" && record.content,
    );
    assert.equal(summarized.length, scenes, "every past scene is closed and summarized");
    await memory.updateSettings(chat.id, { decisionEnabled: false });
    let reads = 0;
    const messages = (await chats.listMessages(chat.id)).map((message) => ({
      ...message,
      extra: new Proxy(typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {}), {
        get: (target, key, receiver) => {
          reads++;
          return Reflect.get(target, key, receiver);
        },
      }),
    }));
    const prepared = await memory.prepare({
      chatId: chat.id,
      messages,
      audienceCharacterIds: ["kaito"],
      budgetTokens: 50000,
    });
    assert.ok(prepared.messageIds.length > 0, "the latest scene stays live");
    return reads / messages.length;
  };

  const small = await readsPerMessage(20);
  const large = await readsPerMessage(80);
  assert.ok(
    large < small * 1.2,
    `four times the scenes must not mean more reads per message: ${small.toFixed(1)} at 20 scenes, ${large.toFixed(1)} at 80`,
  );
  console.log("advanced memory prepare scale regression passed");
} finally {
  provider.close();
  rmSync(directory, { recursive: true, force: true });
}
