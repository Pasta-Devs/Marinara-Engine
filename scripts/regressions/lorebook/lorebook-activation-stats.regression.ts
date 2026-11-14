import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { mock } from "node:test";
import { join } from "node:path";

// Covers lorebook activation statistics: batched writes, the generation hook,
// cascade on entry delete, and failure safety.

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lorebook-activation-stats-"));
const previous = {
  NODE_ENV: process.env.NODE_ENV,
  MARINARA_LITE: process.env.MARINARA_LITE,
  LOG_LEVEL: process.env.LOG_LEVEL,
  AUTO_CREATE_DEFAULT_CONNECTION: process.env.AUTO_CREATE_DEFAULT_CONNECTION,
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
};
let app: Awaited<ReturnType<typeof import("../../../packages/server/src/app.js").buildApp>> | null = null;
let provider: ReturnType<typeof createServer> | null = null;
let db: Awaited<
  ReturnType<typeof import("../../../packages/server/src/db/file-backed-store.js").createFileNativeDB>
> | null = null;

try {
  process.env.NODE_ENV = "test";
  process.env.MARINARA_LITE = "true";
  process.env.LOG_LEVEL = "silent";
  process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;

  const [{ createFileNativeDB }, { buildApp }, stats, featureSettings, { lorebookEntryActivationStats }] =
    await Promise.all([
      import("../../../packages/server/src/db/file-backed-store.js"),
      import("../../../packages/server/src/app.js"),
      import("../../../packages/server/src/services/lorebook/activation-stats.js"),
      import("../../../packages/server/src/services/features/feature-settings.js"),
      import("../../../packages/server/src/db/schema/index.js"),
    ]);
  app = await buildApp();
  db = app.db;
  await app.ready();
  const request = async (method: "GET" | "POST" | "DELETE", url: string, payload?: Record<string, unknown>) => {
    const response = await app!.inject({ method, url, payload });
    assert.ok(response.statusCode < 400, `${method} ${url} -> ${response.statusCode}`);
    return response.body ? response.json() : null;
  };

  const book = await request("POST", "/api/lorebooks", { name: "Stats World" });
  const entry = (name: string, extra: Record<string, unknown>) =>
    request("POST", `/api/lorebooks/${book.id}/entries`, { lorebookId: book.id, name, ...extra });
  const city = await entry("Valdenmoor", { keys: ["Valdenmoor"], content: "The capital." });
  const queen = await entry("Queen Sybel", { keys: ["Sybel"], content: "A monarch." });

  // ── Activation statistics ──
  const statsUrl = `/api/lorebooks/${book.id}/activation-stats`;
  featureSettings.resetFeatureSettingsForTests();
  assert.deepEqual(await request("GET", statsUrl), [], "nothing has fired yet");
  stats.recordLorebookActivations(db, { entryIds: [city.id] });
  await stats.flushLorebookActivationStats(db);
  assert.deepEqual(await request("GET", statsUrl), [], "activation collection is off by default");
  featureSettings.resetFeatureSettingsForTests({ usageAndActivationStats: true });

  stats.recordLorebookActivations(db, {
    entryIds: [city.id, queen.id],
    chatId: "chat-1",
    at: "2026-09-01T00:00:00.000Z",
  });
  stats.recordLorebookActivations(db, {
    entryIds: [city.id, city.id],
    chatId: "chat-2",
    at: "2026-09-02T00:00:00.000Z",
  });
  stats.recordLorebookActivations(db, { entryIds: ["deleted-entry"], chatId: "chat-2" });
  stats.recordLorebookActivations(db, { entryIds: [] });
  await stats.flushLorebookActivationStats(db);

  let rows = (await request("GET", statsUrl)) as Array<Record<string, unknown>>;
  const cityStat = rows.find((row) => row.entryId === city.id);
  assert.equal(cityStat?.count, 2, "one count per generation, duplicates in one generation collapse");
  assert.equal(cityStat?.lastActivatedAt, "2026-09-02T00:00:00.000Z");
  assert.equal(cityStat?.lastChatId, "chat-2");
  assert.equal(cityStat?.lorebookId, book.id);
  assert.equal(rows.find((row) => row.entryId === queen.id)?.count, 1);
  assert.equal(rows.length, 2);
  assert.equal(
    (await db.select().from(lorebookEntryActivationStats)).some((row) => row.entryId === "deleted-entry"),
    false,
    "unknown entry IDs are not persisted, including rows hidden by the route's current-entry filter",
  );

  // A second batch updates in place.
  stats.recordLorebookActivations(db, { entryIds: [queen.id], chatId: "chat-3" });
  await stats.flushLorebookActivationStats(db);
  rows = await request("GET", statsUrl);
  assert.equal(rows.find((row) => row.entryId === queen.id)?.count, 2);

  // Turning the switch off drops pending counts and hides saved stats without deleting them.
  stats.recordLorebookActivations(db, { entryIds: [city.id], chatId: "chat-off" });
  featureSettings.resetFeatureSettingsForTests({ usageAndActivationStats: false });
  await stats.flushLorebookActivationStats(db);
  assert.deepEqual(await request("GET", statsUrl), [], "off hides previously saved activation stats");
  featureSettings.resetFeatureSettingsForTests({ usageAndActivationStats: true });
  rows = await request("GET", statsUrl);
  assert.equal(
    rows.find((row) => row.entryId === city.id)?.count,
    2,
    "off dropped pending data without deleting saved counts",
  );

  // Deleting an entry removes its stats row.
  await request("DELETE", `/api/lorebooks/${book.id}/entries/${queen.id}`);
  assert.deepEqual(await stats.listLorebookActivationStats(db, [queen.id]), []);

  // Exercise the real generation route with the same local SSE-provider pattern as other lorebook proofs.
  const prompts: string[] = [];
  provider = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    prompts.push(Buffer.concat(chunks).toString());
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Welcome to Valdenmoor." } }] })}\n\n` +
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise<void>((resolve) => provider!.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await request("POST", "/api/connections", {
    name: "Stats fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 256,
  });
  const character = await request("POST", "/api/characters", { data: { name: "Stats narrator" } });
  const chat = await request("POST", "/api/chats", {
    name: "Stats generation",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
  const chats = createChatsStorage(db);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableMemoryRecall: false,
    activeLorebookIds: [book.id],
  });
  const generate = async (payload: Record<string, unknown>) => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
    await stats.flushLorebookActivationStats(db!);
  };
  await generate({ userMessage: "Explore Valdenmoor." });
  assert.ok(prompts[0]?.includes("The capital."), "the activated entry reaches the real provider prompt");
  const reply = (await chats.listMessages(chat.id)).filter((message) => message.role === "assistant").at(-1);
  assert.ok(reply, "generation saved an assistant reply");
  assert.ok(
    JSON.parse(reply.extra).lorebookScan.activatedEntries.some((entry: { id: string }) => entry.id === city.id),
    "the saved reply records the activated lore entry",
  );
  rows = await request("GET", statsUrl);
  assert.equal(rows.find((row) => row.entryId === city.id)?.count, 3, "generation records one new activation");
  assert.equal(rows.find((row) => row.entryId === city.id)?.lastChatId, chat.id);
  await generate({ continueMessageId: reply.id });
  assert.ok(prompts[1]?.includes("The capital."), "Continue still sends the activated entry to the provider");
  rows = await request("GET", statsUrl);
  assert.equal(rows.find((row) => row.entryId === city.id)?.count, 3, "Continue does not count the same turn again");

  // Failures never escape: a broken database only logs.
  const brokenDb = {
    transaction: async () => {
      throw new Error("disk on fire");
    },
  } as unknown as typeof db;
  assert.doesNotThrow(() => stats.recordLorebookActivations(brokenDb, { entryIds: [city.id] }));
  await stats.flushLorebookActivationStats(brokenDb);
  assert.doesNotThrow(() =>
    stats.recordLorebookActivations(null as unknown as typeof db, { entryIds: null as unknown as string[] }),
  );

  // Hold only the queued flush timer; real shutdown deadlines and service waits run normally.
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    stats.recordLorebookActivations(db, { entryIds: [city.id], chatId: "chat-shutdown" });
  } finally {
    mock.timers.reset();
  }
  assert.equal((await stats.listLorebookActivationStats(db, [city.id]))[0]?.count, 3, "the final count is pending");
  let countBeforeStoreClose: number | undefined;
  const closeStore = db._fileStore.close.bind(db._fileStore);
  const closeSpy = mock.method(db._fileStore, "close", async () => {
    countBeforeStoreClose = (await stats.listLorebookActivationStats(db!, [city.id]))[0]?.count;
    await closeStore();
  });
  await app.close();
  app = null;
  closeSpy.mock.restore();
  assert.equal(countBeforeStoreClose, 4, "the real shutdown hook flushes pending activations before storage closes");
  db = await createFileNativeDB();
  assert.equal(
    (await stats.listLorebookActivationStats(db, [city.id]))[0]?.count,
    4,
    "the count survives reopening storage",
  );
} finally {
  mock.timers.reset();
  mock.restoreAll();
  await app?.close();
  await db?._fileStore.close();
  if (provider?.listening) {
    await new Promise<void>((resolve, reject) => provider!.close((error) => (error ? reject(error) : resolve())));
  }
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("lorebook-activation-stats regression passed");
