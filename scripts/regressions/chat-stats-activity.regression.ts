import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify");
const root = mkdtempSync(join(tmpdir(), "marinara-chat-stats-activity-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
process.env.NODE_ENV = "test";

const MINUTE = 60_000;

try {
  const {
    CHAT_SITTING_GAP_MS,
    computeChatPlayTime,
    computeChatStats,
    computeDayStreaks,
    countChatWords,
    toLocalDayKey,
  } = await import("../../packages/shared/src/utils/chat-stats.ts");

  // Word counting: contractions and hyphenated words are single words, CJK counts per character.
  assert.equal(countChatWords(""), 0);
  assert.equal(countChatWords("  Hello,   world! "), 2);
  assert.equal(countChatWords("She didn't re-roll the d20."), 5);
  assert.equal(countChatWords('*waves* "Hi!"'), 2);
  assert.equal(countChatWords("你好 world"), 3);
  assert.equal(countChatWords("café naïve"), 2);

  // Sittings: gaps strictly over 30 minutes split; a lone message adds a sitting but no time.
  assert.equal(CHAT_SITTING_GAP_MS, 30 * MINUTE);
  assert.deepEqual(computeChatPlayTime([]), { totalMs: 0, sittings: 0, longestSittingMs: 0, gapMs: 30 * MINUTE });
  assert.deepEqual(computeChatPlayTime([0]), { totalMs: 0, sittings: 1, longestSittingMs: 0, gapMs: 30 * MINUTE });
  const base = Date.UTC(2026, 2, 1, 10, 0);
  const sittings = computeChatPlayTime([
    base + 70 * MINUTE, // unsorted input is fine
    base,
    base + 10 * MINUTE,
    base + 40 * MINUTE, // exactly 30 minutes after the previous message: same sitting
    base + 71 * MINUTE + 1, // not a new sitting: 1 ms over one minute
    base + 200 * MINUTE, // new sitting
    base + 215 * MINUTE,
  ]);
  assert.equal(sittings.sittings, 2);
  assert.equal(sittings.totalMs, 71 * MINUTE + 1 + 15 * MINUTE);
  assert.equal(sittings.longestSittingMs, 71 * MINUTE + 1);
  const split = computeChatPlayTime([base, base + 30 * MINUTE + 1]);
  assert.equal(split.sittings, 2, "a gap just over 30 minutes starts a new sitting");
  assert.equal(split.totalMs, 0);

  // R12 (Golden Mari's play-time unlock): an overnight idle gap between two evenings adds no time.
  const overnight = computeChatPlayTime([
    base,
    base + 20 * MINUTE,
    base + 45 * MINUTE, // first evening: 45 minutes
    base + 14 * 60 * MINUTE, // the tab stayed open overnight: 13h15m of silence
    base + 14 * 60 * MINUTE + 10 * MINUTE, // next morning: 10 minutes
  ]);
  assert.equal(overnight.sittings, 2);
  assert.equal(overnight.totalMs, 55 * MINUTE, "an overnight idle gap must not inflate play time");

  // Local day keys follow Date#getTimezoneOffset semantics (UTC-5 is +300).
  const lateUtc = Date.UTC(2026, 0, 2, 3, 0);
  assert.equal(toLocalDayKey(lateUtc, 0), "2026-01-02");
  assert.equal(toLocalDayKey(lateUtc, 300), "2026-01-01");
  assert.equal(toLocalDayKey(Date.UTC(2026, 0, 1, 22, 0), -180), "2026-01-02");

  // IANA zones follow DST: a summer message is bucketed with the summer offset
  // even when the caller's current (winter) offset is also supplied.
  const { createLocalDayKeyer, normalizeTimeZoneName } = await import("../../packages/shared/src/utils/chat-stats.ts");
  const newYork = createLocalDayKeyer({ timeZone: "America/New_York", timezoneOffsetMinutes: 300 });
  const summerLate = Date.UTC(2026, 6, 1, 4, 30); // 00:30 EDT on July 1, 23:30 on June 30 at a fixed EST offset
  assert.equal(newYork(summerLate), "2026-07-01");
  assert.equal(createLocalDayKeyer({ timezoneOffsetMinutes: 300 })(summerLate), "2026-06-30");
  assert.equal(newYork(Date.UTC(2026, 0, 2, 4, 30)), "2026-01-01", "winter uses EST");
  assert.equal(newYork(Date.UTC(2026, 2, 8, 6, 59)), "2026-03-08", "day after the spring-forward switch");
  assert.equal(createLocalDayKeyer({ timeZone: "Asia/Kolkata" })(Date.UTC(2026, 0, 1, 18, 29)), "2026-01-01");
  assert.equal(createLocalDayKeyer({ timeZone: "Asia/Kolkata" })(Date.UTC(2026, 0, 1, 18, 30)), "2026-01-02");
  assert.equal(normalizeTimeZoneName("Not/AZone"), null);
  assert.equal(normalizeTimeZoneName(""), null);
  assert.equal(
    createLocalDayKeyer({ timeZone: "Not/AZone", timezoneOffsetMinutes: 300 })(summerLate),
    "2026-06-30",
    "an unknown zone falls back to the fixed offset",
  );

  assert.deepEqual(computeDayStreaks(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05"], "2026-01-06"), {
    current: 1,
    longest: 3,
  });
  assert.deepEqual(computeDayStreaks(["2026-01-01", "2026-01-02"], "2026-01-09"), { current: 0, longest: 2 });
  assert.deepEqual(computeDayStreaks([], "2026-01-09"), { current: 0, longest: 0 });

  const iso = (minutes: number) => new Date(base + minutes * MINUTE).toISOString();
  const stats = computeChatStats(
    { id: "c", name: "Chat" },
    [
      {
        id: "m1",
        role: "user",
        speakerKey: "user",
        speakerName: "Alex",
        content: "Hello there friend",
        createdAt: iso(0),
      },
      {
        id: "m2",
        role: "assistant",
        speakerKey: "character:a",
        speakerName: "Ayla",
        content: "One two three four five six",
        createdAt: iso(5),
        tokensPrompt: 1000,
        tokensCompletion: 40,
      },
      {
        id: "m3",
        role: "narrator",
        speakerKey: "narrator",
        speakerName: "Narrator",
        content: "Rain.",
        createdAt: iso(24 * 60),
      },
      {
        id: "m4",
        role: "assistant",
        speakerKey: "character:a",
        speakerName: "Ayla",
        content: "Two words",
        createdAt: iso(24 * 60 + 20),
        tokensPrompt: null,
        tokensCompletion: 10,
      },
    ],
    { messageNumbers: new Map([["m2", 7]]) },
  );
  assert.equal(stats.totalMessages, 4);
  assert.equal(stats.totalWords, 3 + 6 + 1 + 2);
  assert.equal(stats.averageUserWords, 3);
  assert.equal(stats.averageReplyWords, 3, "(6 + 1 + 2) / 3 replies");
  assert.deepEqual(
    stats.speakers.map((speaker) => [
      speaker.name,
      speaker.messages,
      speaker.words,
      speaker.averageWords,
      speaker.longestWords,
    ]),
    [
      ["Ayla", 2, 8, 4, 6],
      ["Alex", 1, 3, 3, 3],
      ["Narrator", 1, 1, 1, 1],
    ],
  );
  assert.deepEqual(stats.messagesPerDay, [
    { date: "2026-03-01", count: 2 },
    { date: "2026-03-02", count: 2 },
  ]);
  assert.equal(stats.activeDays, 2);
  assert.equal(stats.longestMessage?.messageId, "m2");
  assert.equal(stats.longestMessage?.messageNumber, 7, "uses the supplied /goto number");
  assert.equal(stats.longestMessage?.words, 6);
  assert.deepEqual(stats.tokens, { prompt: 1000, completion: 50, total: 1050, messagesWithUsage: 2 });
  assert.equal(stats.playTime.sittings, 2);
  assert.equal(stats.playTime.totalMs, 25 * MINUTE);
  assert.equal(stats.firstMessageAt, iso(0));
  assert.equal(stats.lastMessageAt, iso(24 * 60 + 20));

  const empty = computeChatStats({ id: "e", name: "Empty" }, []);
  assert.equal(empty.totalMessages, 0);
  assert.equal(empty.longestMessage, null);
  assert.equal(empty.firstMessageAt, null);
  assert.equal(empty.playTime.totalMs, 0);

  // Storage-backed stats and the activity overview.
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { chats, messages, characters, personas } = await import("../../packages/server/src/db/schema/index.js");
  const { eq } = await import("../../packages/server/src/db/file-query.js");
  const { buildActivityOverview, computeStoredChatStats, createActivityOverviewCache } =
    await import("../../packages/server/src/services/chat-insights/chat-insights.service.js");
  const { chatInsightsRoutes } = await import("../../packages/server/src/routes/chat-insights.routes.js");
  const db = await createFileNativeDB();
  const created = iso(0);
  await db
    .insert(characters)
    .values({ id: "char-a", data: JSON.stringify({ name: "Ayla" }), createdAt: created, updatedAt: created });
  await db.insert(personas).values({ id: "persona-1", name: "Alex", createdAt: created, updatedAt: created });
  await db.insert(chats).values([
    {
      id: "chat-a",
      name: "Road",
      mode: "roleplay",
      characterIds: JSON.stringify(["char-a"]),
      personaId: "persona-1",
      createdAt: created,
      updatedAt: created,
    },
    { id: "chat-b", name: "Side", mode: "conversation", characterIds: "[]", createdAt: created, updatedAt: created },
    {
      id: "chat-mari",
      name: "Mari",
      mode: "conversation",
      characterIds: "[]",
      metadata: JSON.stringify({ internalAssistant: "professor-mari" }),
      createdAt: created,
      updatedAt: created,
    },
  ]);
  await db.insert(messages).values([
    { id: "a1", chatId: "chat-a", role: "system", content: "System setup text here", createdAt: iso(-5) },
    { id: "a2", chatId: "chat-a", role: "user", content: "Hi Ayla", createdAt: iso(0) },
    {
      id: "a3",
      chatId: "chat-a",
      role: "assistant",
      characterId: "char-a",
      content: "Hello traveller, welcome home",
      extra: JSON.stringify({ generationInfo: { tokensPrompt: 500, tokensCompletion: 20 } }),
      createdAt: iso(10),
    },
    {
      id: "a4",
      chatId: "chat-a",
      role: "user",
      content: "hidden",
      extra: JSON.stringify({ hiddenFromUser: true }),
      createdAt: iso(12),
    },
    { id: "a5", chatId: "chat-a", role: "user", content: "Back again", createdAt: iso(24 * 60) },
    // chat-b overlaps chat-a's first sitting: global play time must not count it twice.
    { id: "b1", chatId: "chat-b", role: "user", content: "side note", createdAt: iso(2) },
    { id: "b2", chatId: "chat-b", role: "assistant", content: "ok", createdAt: iso(8) },
    { id: "m1", chatId: "chat-mari", role: "user", content: "internal", createdAt: iso(3) },
  ]);

  const stored = await computeStoredChatStats(db, (await db.select().from(chats).where(eq(chats.id, "chat-a")))[0]);
  assert.equal(stored.totalMessages, 3, "system and hidden messages are excluded");
  assert.deepEqual(
    stored.speakers.map((speaker) => [speaker.name, speaker.role, speaker.messages]),
    [
      ["Alex", "user", 2],
      ["Ayla", "assistant", 1],
    ],
    "equal word counts rank the busier speaker first; the persona name labels user turns",
  );
  assert.equal(stored.longestMessage?.messageId, "a3");
  assert.equal(stored.longestMessage?.messageNumber, 3, "numbering counts the stored system message");
  assert.deepEqual(stored.tokens, { prompt: 500, completion: 20, total: 520, messagesWithUsage: 1 });
  assert.equal(stored.playTime.totalMs, 10 * MINUTE);
  assert.equal(stored.playTime.sittings, 2);

  const overview = await buildActivityOverview(db, { now: base + 24 * 60 * MINUTE });
  assert.equal(overview.totalMessages, 5);
  assert.equal(overview.activeChats, 2);
  assert.deepEqual(overview.days, { "2026-03-01": 4, "2026-03-02": 1 });
  assert.equal(overview.activeDays, 2);
  assert.equal(overview.currentStreakDays, 2);
  assert.equal(overview.longestStreakDays, 2);
  assert.equal(overview.playTime.totalMs, 10 * MINUTE, "overlapping chats share one timeline");
  assert.deepEqual(
    overview.topChats.map((chat) => [chat.chatId, chat.messages, chat.playTimeMs]),
    [
      ["chat-a", 3, 10 * MINUTE],
      ["chat-b", 2, 6 * MINUTE],
    ],
  );
  assert.equal(overview.totalWords, 2 + 4 + 2 + 2 + 1);

  const shifted = await buildActivityOverview(db, { timezoneOffsetMinutes: 11 * 60, now: base });
  assert.deepEqual(shifted.days, { "2026-02-28": 4, "2026-03-01": 1 }, "days follow the caller's time zone");

  const cache = createActivityOverviewCache(db, 60_000);
  const first = await cache.get(0);
  await db.insert(messages).values({ id: "b3", chatId: "chat-b", role: "user", content: "later", createdAt: iso(30) });
  assert.equal((await cache.get(0)).totalMessages, first.totalMessages, "cached for the TTL");
  assert.equal((await cache.get(0, { refresh: true })).totalMessages, first.totalMessages + 1, "refresh bypasses");

  // Incremental summaries: an unchanged store re-reads no chat on a cache miss.
  const summaries = cache.summaries;
  const scannedBefore = summaries.stats.scanned;
  const again = await cache.get(0, { refresh: true });
  assert.equal(again.totalMessages, first.totalMessages + 1);
  assert.equal(summaries.stats.scanned, scannedBefore, "no writes since the last build: every chat summary is reused");
  // Another zone reuses the same summaries too.
  await cache.get(0, { timeZone: "Asia/Tokyo" });
  assert.equal(summaries.stats.scanned, scannedBefore);
  // An edit that does not move lastMessageAt is still picked up.
  await db.update(messages).set({ content: "side note with more words" }).where(eq(messages.id, "b1"));
  const edited = await cache.get(0, { refresh: true });
  assert.equal(edited.totalWords, again.totalWords + 3, "edited resident chat is re-read");
  // A flushed edit remains relevant after the store evicts that chat unit.
  await db.update(messages).set({ content: "side note with even more extra words" }).where(eq(messages.id, "b1"));
  await db.select().from(messages).where(eq(messages.chatId, "chat-a"));
  await db.select().from(messages).where(eq(messages.chatId, "chat-mari"));
  const previousResidentCap = process.env.MARINARA_MAX_RESIDENT_CHATS;
  try {
    process.env.MARINARA_MAX_RESIDENT_CHATS = "2";
    await db._fileStore.flush();
    assert.equal(db._fileStore.getResidentChatUnits().has("chat-b"), false, "edited chat was evicted");
    const evicted = await cache.get(0, { refresh: true });
    assert.equal(evicted.totalWords, edited.totalWords + 2, "edited non-resident chat is re-read");
  } finally {
    if (previousResidentCap === undefined) delete process.env.MARINARA_MAX_RESIDENT_CHATS;
    else process.env.MARINARA_MAX_RESIDENT_CHATS = previousResidentCap;
  }
  // Deleted chats drop out of the overview and the summary cache.
  await db.delete(messages).where(eq(messages.chatId, "chat-b"));
  await db.delete(chats).where(eq(chats.id, "chat-b"));
  const afterDelete = await cache.get(0, { refresh: true });
  assert.deepEqual(
    afterDelete.topChats.map((chat) => chat.chatId),
    ["chat-a"],
  );

  const app = Fastify();
  app.decorate("db", db);
  await app.register(chatInsightsRoutes, { prefix: "/api/chat-insights" });
  await app.ready();
  const statsResponse = await app.inject({ method: "GET", url: "/api/chat-insights/chats/chat-a/stats?tzOffset=0" });
  assert.equal(statsResponse.statusCode, 200);
  assert.equal(statsResponse.json().totalMessages, 3);
  assert.equal((await app.inject({ method: "GET", url: "/api/chat-insights/chats/chat-mari/stats" })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET", url: "/api/chat-insights/chats/missing/stats" })).statusCode, 404);
  const activityResponse = await app.inject({ method: "GET", url: "/api/chat-insights/activity?tzOffset=0" });
  assert.equal(activityResponse.statusCode, 200);
  assert.equal(activityResponse.json().totalMessages, 3);
  const zoned = await app.inject({
    method: "GET",
    url: "/api/chat-insights/activity?tzOffset=0&tz=Pacific%2FKiritimati",
  });
  assert.equal(zoned.statusCode, 200);
  assert.deepEqual(
    zoned.json().days,
    { "2026-03-02": 2, "2026-03-03": 1 },
    "the IANA zone (UTC+14) sets the day buckets",
  );
  const bogusZone = await app.inject({ method: "GET", url: "/api/chat-insights/activity?tzOffset=0&tz=Not%2FAZone" });
  assert.equal(bogusZone.statusCode, 200, "an unknown zone falls back to the offset");

  for (const path of ["/activity", "/chats/chat-a/stats"]) {
    for (const query of ["tz=UTC&tz=Pacific%2FKiritimati", "tzOffset=0&tzOffset=60"]) {
      const repeated = await app.inject({ method: "GET", url: `/api/chat-insights${path}?${query}` });
      assert.equal(repeated.statusCode, 400, `${path} rejects repeated timezone parameters: ${query}`);
    }
    const single = await app.inject({
      method: "GET",
      url: `/api/chat-insights${path}?tzOffset=0&tz=Pacific%2FKiritimati`,
    });
    assert.equal(single.statusCode, 200, `${path} still accepts a single timezone and offset`);
  }

  await app.close();
  await db._fileStore.close();
  process.stdout.write("chat-stats-activity regression passed\n");
} finally {
  rmSync(root, { recursive: true, force: true });
}
