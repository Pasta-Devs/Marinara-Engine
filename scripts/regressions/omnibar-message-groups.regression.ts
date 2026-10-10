import assert from "node:assert/strict";
import { buildOmnibarGlobalMessageResults } from "../../packages/client/src/lib/omnibar-results.js";

// Fallback text with {{name}} filled from the options, so row titles can be read in the assertions.
const t = (_key: string, fallback: string, options?: Record<string, unknown>) =>
  fallback.replace(/\{\{(\w+)\}\}/gu, (_match, name: string) => String(options?.[name] ?? ""));

const chats = [
  { chatId: "chat-rp", chatName: "Moon Road", chatMode: "roleplay", matches: 3, cast: ["Ayla"] },
  { chatId: "chat-convo", chatName: "Idle talk", chatMode: "conversation", matches: 1, cast: [] },
] as const;
const hits = [
  {
    chatId: "chat-rp",
    chatName: "Moon Road",
    chatMode: "roleplay",
    messageId: "rp-4",
    messageNumber: 4,
    role: "narrator",
    speaker: null,
    characterId: null,
    createdAt: "2026-01-10T12:00:00.000Z",
    snippet: "The silver moon sets.",
    highlights: [[4, 16]],
  },
  {
    chatId: "chat-rp",
    chatName: "Moon Road",
    chatMode: "roleplay",
    messageId: "rp-2",
    messageNumber: 2,
    role: "assistant",
    speaker: "Ayla",
    characterId: "char-ayla",
    createdAt: "2026-01-03T12:00:00.000Z",
    snippet: "Ayla points at the Silver Moon.",
    highlights: [[20, 32]],
  },
  {
    chatId: "chat-convo",
    chatName: "Idle talk",
    chatMode: "conversation",
    messageId: "cv-2",
    messageNumber: 2,
    role: "assistant",
    speaker: null,
    characterId: null,
    createdAt: "2026-01-05T12:00:00.000Z",
    snippet: "Silver moon trivia!",
    highlights: [[0, 12]],
  },
] as const;

const build = (overrides: Partial<Parameters<typeof buildOmnibarGlobalMessageResults>[0]> = {}) =>
  buildOmnibarGlobalMessageResults({
    activeChatId: null,
    chats: chats as never,
    hits: hits as never,
    messageSearchQuery: "moon",
    t,
    ...overrides,
  });

// Chat rows lead, their hit lines follow, and "N more" closes a chat that has more matches than shown.
const rows = build();
assert.deepEqual(
  rows.map((row) => row.id),
  [
    "message-chat:chat-rp",
    "message:chat-rp:4",
    "message:chat-rp:2",
    "message-more:chat-rp",
    "message-chat:chat-convo",
    "message:chat-convo:2",
    "global-search:see-all",
  ],
  "each chat is a group: its row, its hits, then the rest of its matches",
);
assert.deepEqual(rows[0]!.target, { kind: "chat", chatId: "chat-rp" }, "the chat row opens its chat");
assert.equal(rows[0]!.description, "with Ayla", "line 2 of a chat row is its cast");
assert.equal(rows[0]!.meta, "3 matches", "the match count sits at the end of the chat row");
assert.equal(rows[4]!.description, undefined, "a chat with no cast has no line 2");
assert.equal(rows[1]!.parentId, "message-chat:chat-rp", "a hit line points at its chat row");
assert.equal(rows[1]!.title, "You", "a narrator turn is shown as You");
assert.equal(rows[2]!.title, "Ayla", "a character turn is shown as its speaker");
assert.equal(rows[3]!.title, "1 more in Moon Road", "the rest of the chat's matches are one line");
assert.equal(rows[6]!.title, "See all 4 matches", "see-all counts every match across chats");

// Scores fall in list order, so the presentation keeps each chat's rows together.
for (let index = 1; index < rows.length; index += 1) {
  assert.ok(rows[index]!.score < rows[index - 1]!.score, "scores fall in list order");
}

// The active chat is answered by the in-chat rows, so it gets no group here.
const withoutActive = build({ activeChatId: "chat-rp" });
assert.deepEqual(
  withoutActive.map((row) => row.id),
  ["message-chat:chat-convo", "message:chat-convo:2"],
  "the open chat is skipped, and see-all is left out when every other match is shown",
);

// A bare command word keeps one chat's lines, so "new" does not fill the list with messages.
assert.deepEqual(
  build({ messageSearchQuery: "new" }).map((row) => row.id),
  ["message-chat:chat-rp", "message:chat-rp:4", "message:chat-rp:2", "message-more:chat-rp", "global-search:see-all"],
  "a bare command word shows one chat only",
);

// No group without a chat row, and nothing for a query too short to search.
assert.deepEqual(build({ chats: [] as never, hits: [] as never }), []);
assert.deepEqual(build({ messageSearchQuery: "mo" }), []);

process.stdout.write("omnibar-message-groups regression passed\n");
