import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify");
const root = mkdtempSync(join(tmpdir(), "marinara-chat-global-search-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
process.env.NODE_ENV = "test";

try {
  const { buildChatSearchSnippet, compileChatSearchQuery, matchesChatSearchQuery, parseChatSearchQuery } =
    await import("../../packages/shared/src/utils/chat-search-query.ts");

  // Query parsing: quoted phrases stay whole, loose words split, duplicates collapse.
  assert.deepEqual(parseChatSearchQuery('dragon "silver moon"  Dragon'), {
    needles: ["dragon", "silver moon"],
    phrases: ["silver moon"],
  });
  assert.deepEqual(parseChatSearchQuery("“smart quotes” work").needles, ["smart quotes", "work"]);
  assert.deepEqual(parseChatSearchQuery('open "quote runs to end').needles, ["open", "quote runs to end"]);
  assert.deepEqual(parseChatSearchQuery("   ").needles, []);
  assert.deepEqual(parseChatSearchQuery("a+b (c) [d]").needles, ["a+b", "(c)", "[d]"], "regex characters are literal");

  const moon = compileChatSearchQuery('"silver moon" dragon');
  assert.equal(
    matchesChatSearchQuery("The SILVER\n moon rose over the Dragon.", moon),
    true,
    "case and whitespace insensitive",
  );
  assert.equal(matchesChatSearchQuery("silver moon only", moon), false, "every needle must match");
  assert.equal(matchesChatSearchQuery("the moon is silver, dragon", moon), false, "phrases keep word order");
  assert.equal(matchesChatSearchQuery("anything", compileChatSearchQuery("")), false);
  assert.equal(matchesChatSearchQuery("costs $5 (maybe)", compileChatSearchQuery("$5 (maybe)")), true);

  const short = buildChatSearchSnippet("A  dragon\nsleeps under the silver moon.", moon);
  assert.equal(short.text, "A dragon sleeps under the silver moon.");
  assert.deepEqual(
    short.highlights.map(([start, end]) => short.text.slice(start, end)),
    ["dragon", "silver moon"],
    "highlight offsets point at the collapsed snippet text",
  );

  const long = `${"filler ".repeat(80)}the silver moon and a dragon ${"tail ".repeat(80)}`;
  const snippet = buildChatSearchSnippet(long, moon, 120);
  assert.ok(snippet.text.startsWith("…") && snippet.text.endsWith("…"), "long snippets are trimmed on both sides");
  assert.ok(snippet.text.length <= 122);
  assert.deepEqual(
    snippet.highlights.map(([start, end]) => snippet.text.slice(start, end)),
    ["silver moon", "dragon"],
  );

  // Storage-backed search across chats.
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { chats, messages, characters } = await import("../../packages/server/src/db/schema/index.js");
  const { searchAllChats } = await import("../../packages/server/src/services/chat-insights/chat-insights.service.js");
  const { chatInsightsRoutes } = await import("../../packages/server/src/routes/chat-insights.routes.js");
  const db = await createFileNativeDB();

  const at = (day: number, minute = 0) => new Date(Date.UTC(2026, 0, day, 12, minute)).toISOString();
  await db.insert(characters).values({
    id: "char-ayla",
    data: JSON.stringify({ name: "Ayla" }),
    createdAt: at(1),
    updatedAt: at(1),
  });
  await db.insert(chats).values([
    {
      id: "chat-rp",
      name: "Moon Road",
      mode: "roleplay",
      characterIds: JSON.stringify(["char-ayla"]),
      lastMessageAt: at(10),
      createdAt: at(1),
      updatedAt: at(10),
    },
    {
      id: "chat-convo",
      name: "Idle talk",
      mode: "conversation",
      characterIds: "[]",
      lastMessageAt: at(5),
      createdAt: at(1),
      updatedAt: at(5),
    },
    {
      id: "chat-mari",
      name: "Professor Mari",
      mode: "conversation",
      characterIds: "[]",
      metadata: JSON.stringify({ internalAssistant: "professor-mari" }),
      lastMessageAt: at(11),
      createdAt: at(1),
      updatedAt: at(11),
    },
  ]);
  await db.insert(messages).values([
    { id: "rp-1", chatId: "chat-rp", role: "user", content: "We follow the silver moon.", createdAt: at(2) },
    {
      id: "rp-2",
      chatId: "chat-rp",
      role: "assistant",
      characterId: "char-ayla",
      content: "Ayla points at the Silver Moon, eyes bright.",
      createdAt: at(3),
    },
    {
      id: "rp-3",
      chatId: "chat-rp",
      role: "assistant",
      characterId: "char-ayla",
      content: "A hidden silver moon note.",
      extra: JSON.stringify({ hiddenFromUser: true }),
      createdAt: at(4),
    },
    { id: "rp-4", chatId: "chat-rp", role: "narrator", content: "The silver moon sets.", createdAt: at(10) },
    { id: "rp-system", chatId: "chat-rp", role: "system", content: "silver moon internal setup", createdAt: at(11) },
    { id: "cv-1", chatId: "chat-convo", role: "user", content: "no match here", createdAt: at(4) },
    { id: "cv-2", chatId: "chat-convo", role: "assistant", content: "Silver moon trivia!", createdAt: at(5) },
    { id: "mari-1", chatId: "chat-mari", role: "assistant", content: "silver moon secrets", createdAt: at(11) },
  ]);

  const all = await searchAllChats(db, { query: '"silver moon"' });
  assert.deepEqual(
    all.results.map((result) => result.messageId),
    ["rp-4", "rp-2", "rp-1", "cv-2"],
    "newest chat first, newest match first, hidden and internal chats skipped",
  );
  assert.equal(all.hasMore, false);
  assert.equal(all.partial, false);
  assert.equal(all.totalChats, 2);
  const ayla = all.results.find((result) => result.messageId === "rp-2")!;
  assert.equal(ayla.messageNumber, 2, "message numbers count every stored message, like /goto");
  assert.equal(ayla.speaker, "Ayla");
  assert.equal(ayla.chatName, "Moon Road");
  assert.equal(ayla.snippet.slice(ayla.highlights[0]![0], ayla.highlights[0]![1]), "Silver Moon");
  assert.equal(all.results.find((result) => result.messageId === "rp-4")!.messageNumber, 4);

  const page1 = await searchAllChats(db, { query: "moon", limit: 2 });
  assert.deepEqual(
    page1.results.map((result) => result.messageId),
    ["rp-4", "rp-2"],
  );
  assert.equal(page1.hasMore, true);
  const page2 = await searchAllChats(db, { query: "moon", limit: 2, offset: 2 });
  assert.deepEqual(
    page2.results.map((result) => result.messageId),
    ["rp-1", "cv-2"],
  );
  assert.equal(page2.hasMore, false);

  assert.deepEqual(
    (await searchAllChats(db, { query: "moon", mode: "conversation" })).results.map((result) => result.messageId),
    ["cv-2"],
  );
  assert.deepEqual(
    (await searchAllChats(db, { query: "moon", characterId: "char-ayla", role: "user" })).results.map(
      (result) => result.messageId,
    ),
    ["rp-1"],
  );
  assert.deepEqual(
    (await searchAllChats(db, { query: "moon", from: "2026-01-03", to: "2026-01-05" })).results.map(
      (result) => result.messageId,
    ),
    ["rp-2", "cv-2"],
    "bare dates cover whole days",
  );
  assert.equal((await searchAllChats(db, { query: "moon", limit: 5000 })).limit, 100, "limit is capped");
  // Past the offset cap the page is empty and final, never the capped page repeated.
  const pastCap = await searchAllChats(db, { query: "moon", offset: 5_000 });
  assert.deepEqual(pastCap.results, []);
  assert.equal(pastCap.hasMore, false);
  const atCap = await searchAllChats(db, { query: "moon", offset: 1_000, limit: 1 });
  assert.equal(atCap.hasMore, false, "no next page is offered beyond the offset cap");
  // Quote-only, whitespace-only and regex-special queries never throw.
  assert.deepEqual((await searchAllChats(db, { query: '""' })).results, []);
  assert.deepEqual((await searchAllChats(db, { query: '"   ' })).results, []);
  assert.deepEqual((await searchAllChats(db, { query: "(.*[" })).results, []);
  const timedOut = await searchAllChats(db, { query: "moon", timeBudgetMs: -1 });
  assert.equal(timedOut.partial, true, "an exhausted time budget reports a partial scan");
  assert.equal(timedOut.results.length, 0);

  // perChat: every chat is counted, each chat keeps its newest hits, and `limit` caps the page.
  assert.deepEqual(all.chats, [], "chat counts are only returned when perChat is asked");
  const grouped = await searchAllChats(db, { query: "moon", perChat: 2 });
  assert.deepEqual(grouped.chats, [
    { chatId: "chat-rp", chatName: "Moon Road", chatMode: "roleplay", matches: 3, cast: ["Ayla"] },
    { chatId: "chat-convo", chatName: "Idle talk", chatMode: "conversation", matches: 1, cast: [] },
  ]);
  assert.deepEqual(
    grouped.results.map((result) => result.messageId),
    ["rp-4", "rp-2", "cv-2"],
    "at most two hits per chat, newest first, the 3rd Moon Road match is counted but not listed",
  );
  assert.equal(grouped.results[1]!.characterId, "char-ayla", "character turns carry the speaker id");
  assert.equal(grouped.results[0]!.characterId, null, "narrator turns carry no speaker id");
  assert.equal(grouped.hasMore, false);
  const capped = await searchAllChats(db, { query: "moon", perChat: 1, limit: 1 });
  assert.deepEqual(
    capped.results.map((result) => result.messageId),
    ["rp-4"],
    "limit caps the listed hits",
  );
  assert.deepEqual(
    capped.chats.map((chat) => chat.matches),
    [3, 1],
    "counts still cover every chat past the limit",
  );

  const app = Fastify();
  app.decorate("db", db);
  await app.register(chatInsightsRoutes, { prefix: "/api/chat-insights" });
  await app.ready();
  const response = await app.inject({ method: "GET", url: "/api/chat-insights/search?q=trivia&limit=5" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    response.json().results.map((result: { messageId: string }) => result.messageId),
    ["cv-2"],
  );
  assert.equal((await app.inject({ method: "GET", url: "/api/chat-insights/search?q=%20" })).statusCode, 400);
  const perChatResponse = await app.inject({ method: "GET", url: "/api/chat-insights/search?q=moon&perChat=1&limit=5" });
  assert.deepEqual(
    perChatResponse.json().chats.map((chat: { matches: number }) => chat.matches),
    [3, 1],
    "the route passes perChat through",
  );
  for (const field of ["characterId", "from", "to"]) {
    const repeated = await app.inject({
      method: "GET",
      url: `/api/chat-insights/search?q=moon&${field}=one&${field}=two`,
    });
    assert.equal(repeated.statusCode, 400, `duplicate ${field} values are rejected instead of causing a server error`);
  }

  await app.close();
  await db._fileStore.close();
  process.stdout.write("chat-global-search regression passed\n");
} finally {
  rmSync(root, { recursive: true, force: true });
}
