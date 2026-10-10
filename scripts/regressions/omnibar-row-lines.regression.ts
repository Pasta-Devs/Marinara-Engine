import assert from "node:assert/strict";
import { PROVIDERS } from "../../packages/shared/src/constants/providers.ts";
import { buildOmnibarChatRows, buildOmnibarConnectionRows } from "../../packages/client/src/lib/omnibar-entity-rows.js";
import { buildOmnibarLorebookEntryResults } from "../../packages/client/src/lib/omnibar-results.js";
import { searchOmnibar } from "../../packages/client/src/lib/omnibar-search.js";

const t = (_key: string, fallback: string, options?: Record<string, unknown>) =>
  fallback.replace(/\{\{(\w+)\}\}/gu, (_match, name: string) => String(options?.[name] ?? ""));

// Lorebook entries: line 2 is the keys, the book is the meta, and line 3 only when the content matched.
const entry = (overrides: Record<string, unknown>) => ({
  id: "entry-1",
  lorebookId: "book-1",
  name: "Harbor",
  keys: ["harbor", "dock"],
  content: "The harbor bell rings at dawn and the ships leave with the tide.",
  enabled: true,
  ...overrides,
});
const [byContent, byName] = buildOmnibarLorebookEntryResults({
  entries: [entry({}), entry({ id: "entry-2", name: "Tide Clock", keys: ["tide"], content: "A brass clock." })] as never,
  lorebookNameById: new Map([["book-1", "Port Notes"]]),
  query: "bell",
  t,
});
assert.equal(byContent!.description, "Keys: harbor, dock", "line 2 is the keys");
assert.equal(byContent!.meta, "Port Notes", "the book is the row's end meta, not line 2");
assert.match(byContent!.excerpt ?? "", /bell/u, "the content that matched is line 3");
assert.deepEqual(
  byContent!.excerptMatch,
  [(byContent!.excerpt ?? "").indexOf("bell"), (byContent!.excerpt ?? "").indexOf("bell") + 4],
  "the match is marked inside line 3",
);
assert.equal(byName!.excerpt, undefined, "a row matched by something other than its text has no line 3");
assert.equal(byName!.meta, "Port Notes", "without content, the book still names the row");

// Connections: the provider's display name, never the raw id, in line 2 with the model.
const [connection] = buildOmnibarConnectionRows({
  connections: [{ id: "c1", name: "Local", provider: "custom", model: "gpt-x" }],
  categoryLabels: {} as never,
  t,
});
const subtitle = connection!.preview().subtitle;
assert.equal(subtitle, `gpt-x · ${PROVIDERS.custom.name}`, "model, then the provider's display name");
assert.ok(!String(subtitle).includes("custom"), "the raw provider id is not shown");

// Chats: line 2 in search is the cast (two names, then +N); the Continue and Recent rows keep the last line.
const chatRow = (characterIds: string[]) =>
  buildOmnibarChatRows({
    chats: [
      {
        id: "chat-1",
        name: "Moon Road",
        mode: "roleplay",
        characterIds,
        lastMessageAt: "2026-01-10T12:00:00.000Z",
        updatedAt: "2026-01-10T12:00:00.000Z",
      },
    ] as never,
    characterById: new Map([
      ["ayla", { data: { name: "Ayla" } }],
      ["bo", { data: { name: "Bo" } }],
      ["cy", { data: { name: "Cy" } }],
    ]),
    connectionById: new Map(),
    personaById: new Map(),
    chatModeLabels: { roleplay: "Roleplay", conversation: "Conversation", game: "Game" } as never,
    latestMessageByChatId: new Map([["chat-1", { role: "assistant", content: "We ride out.", characterId: "ayla" }]]) as never,
    t,
    now: Date.parse("2026-01-10T12:05:00.000Z"),
  })[0]!;
const threeCast = chatRow(["ayla", "bo", "cy"]);
assert.equal(threeCast.preview().subtitle, "with Ayla, Bo +1", "search line 2: two names, then +N");
assert.equal(threeCast.description, "with Ayla, Bo +1", "the search row carries the same cast line");
assert.equal(threeCast.recentLine, "Ayla: We ride out.", "Continue and Recent keep where the chat left off");
assert.equal(chatRow([]).preview().subtitle, undefined, "a chat with no cast has no line 2 in search");

// Equal name matches: the chat active more recently lists first. The older chat's id sorts first, so only recency puts the newer one ahead.
const chatHits = searchOmnibar("harbor", {
  commands: [],
  chats: [
    { id: "a-old", name: "Harbor", lastActive: Date.parse("2026-03-01T00:00:00Z") },
    { id: "b-new", name: "Harbor", lastActive: Date.parse("2026-10-09T10:00:00Z") },
  ],
  resources: [],
  connections: [],
} as never).filter((result) => result.id.startsWith("chat:"));
assert.deepEqual(
  chatHits.map((result) => result.id),
  ["chat:b-new", "chat:a-old"],
  "the more recent chat leads an equal name match",
);

process.stdout.write("omnibar-row-lines regression passed\n");
