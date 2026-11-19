// The Chat Summary routes: combining entries puts the new one where the first chosen entry was and keeps the chosen
// ones as inactive history, a combine too big for the connection is refused before anything is sent to the model, and
// a reorder saves the order the user chose. Drives the real chats routes on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-summary-combine-route-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { estimateChatSummaryTokens } = await import("../../../packages/shared/src/utils/chat-summary-entries.js");
const { resolveChatSummaryCombinePrompt, resolveChatSummaryPrompt } =
  await import("../../../packages/server/src/services/generation/roleplay-summary-runtime.js");
const db = await getDB();
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });

let providerRequests = 0;
const provider = createServer((request, response) => {
  providerRequests += 1;
  request.resume();
  response.setHeader("content-type", "application/json");
  response.end(
    JSON.stringify({
      choices: [
        {
          message: { role: "assistant", content: '{"summary":"Combined text.","title":"Combined"}' },
          finish_reason: "stop",
        },
      ],
    }),
  );
});

type Entry = { id: string; title: string; content: string; enabled: boolean };
const SUMMARY_MAX_TOKENS = 1024;
const entry = (id: string, content = `Summary ${id}.`) => ({
  id,
  kind: "rolling",
  origin: "manual",
  title: `Entry ${id}`,
  content,
  enabled: true,
  tokenEstimate: 4,
  createdAt: "2026-10-11T10:00:00.000Z",
  updatedAt: "2026-10-11T10:00:00.000Z",
});

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const createConnection = async (maxContext: number) => {
    const connection = await connections.create({
      name: `Summary fixture ${maxContext}`,
      provider: "custom",
      model: "fixture",
      apiKey: "fixture",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      maxContext,
    });
    assert(connection);
    return connection.id;
  };
  const createChat = async (connectionId: string, summaryEntries: ReturnType<typeof entry>[]) => {
    const chat = await chats.create({ name: "Summaries", mode: "roleplay", characterIds: [], connectionId });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      automaticSummaryEnabled: false,
      summaryMaxTokens: SUMMARY_MAX_TOKENS,
      summaryEntries,
    });
    return chat.id;
  };
  const entries = async (chatId: string) => {
    const chat = await chats.getById(chatId);
    assert(chat);
    const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
    return (metadata.summaryEntries ?? []) as Entry[];
  };
  const combine = (chatId: string, summaryEntryIds: string[]) =>
    app.inject({ method: "POST", url: `/api/chats/${chatId}/generate-summary`, payload: { summaryEntryIds } });

  // Combining b and d out of a-d.
  const roomy = await createConnection(32_768);
  const combinedChat = await createChat(roomy, [entry("a"), entry("b"), entry("c"), entry("d")]);
  const combined = await combine(combinedChat, ["b", "d"]);
  assert.equal(combined.statusCode, 200, combined.body);
  const afterCombine = await entries(combinedChat);
  const newEntry = afterCombine.find((item) => item.content === "Combined text.");
  assert(newEntry, "the combined entry is saved");
  assert.equal(
    afterCombine.indexOf(newEntry),
    1,
    "Combined summaries must replace their selected entries at the first selected chronological position",
  );
  for (const id of ["b", "d"]) {
    const source = afterCombine.find((item) => item.id === id);
    assert(source, `${id} is kept as history`);
    assert.equal(source.enabled, false, `${id} no longer feeds the prompt`);
  }
  assert.deepEqual(
    afterCombine.filter((item) => item.id === "a" || item.id === "c").map((item) => item.enabled),
    [true, true],
    "entries that weren't chosen stay as they were",
  );

  // The input budget is the context, less the reply's room, both prompts and the per-message overhead.
  const big = [entry("x", "word ".repeat(300)), entry("y", "word ".repeat(300))];
  const sourceText = big.map((item, index) => `Summary ${index + 1} — ${item.title}:\n${item.content}`).join("\n\n");
  const needed =
    estimateChatSummaryTokens(sourceText) +
    SUMMARY_MAX_TOKENS +
    estimateChatSummaryTokens(
      resolveChatSummaryPrompt({ requestedTemplateId: null, chatMetadata: {}, globalSettingsValue: null }),
    ) +
    estimateChatSummaryTokens(resolveChatSummaryCombinePrompt(null)) +
    64;
  const tooSmall = await createChat(await createConnection(needed - 1), big);
  const requestsBefore = providerRequests;
  const refused = await combine(tooSmall, ["x", "y"]);
  assert.equal(refused.statusCode, 400, refused.body);
  assert.equal(refused.json().error, "Selected summaries are too large to combine at once");
  assert.equal(providerRequests, requestsBefore, "an oversized combine is refused before the model is called");
  assert.deepEqual(
    (await entries(tooSmall)).map((item) => [item.id, item.enabled]),
    [
      ["x", true],
      ["y", true],
    ],
    "a refused combine changes nothing",
  );
  const justFits = await createChat(await createConnection(needed), big);
  const accepted = await combine(justFits, ["x", "y"]);
  assert.equal(accepted.statusCode, 200, `a combine that exactly fits the budget goes ahead: ${accepted.body}`);

  // A reorder saves exactly the order the user chose.
  const reorderChat = await createChat(roomy, [entry("a"), entry("b"), entry("c")]);
  const reordered = await app.inject({
    method: "PATCH",
    url: `/api/chats/${reorderChat}/summary-entries`,
    payload: { operation: "reorder", entryIds: ["c", "a", "b"] },
  });
  assert.equal(reordered.statusCode, 200, reordered.body);
  assert.deepEqual(
    (await entries(reorderChat)).map((item) => item.id),
    ["c", "a", "b"],
    "Summary reorder requests must persist the complete user-selected entry order",
  );
} finally {
  await app.close();
  await new Promise((resolve) => provider.close(resolve));
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
