import assert from "node:assert/strict";
import type { Message } from "@marinara-engine/shared";
import {
  cachedMariThread,
  keepUnchangedMessages,
  rememberMariThread,
  rememberMariThreads,
} from "../../packages/client/src/lib/mari-thread-cache.js";

const message = (id: string, content: string) =>
  ({ id, chatId: "a", role: "assistant", content }) as unknown as Message;

// Unchanged messages keep their objects; nothing changed returns the old list itself (no re-render).
const one = message("1", "hello");
const two = message("2", "world");
const previous = [one, two];
assert.equal(keepUnchangedMessages(previous, [message("1", "hello"), message("2", "world")]), previous);
const edited = keepUnchangedMessages(previous, [message("1", "hello"), message("2", "edited")]);
assert.notEqual(edited, previous);
assert.equal(edited[0], one, "the unchanged row keeps its object");
assert.equal(edited[1]!.content, "edited");
const grown = keepUnchangedMessages(
  previous,
  [one, two, message("3", "new")].map((m) => ({ ...m })),
);
assert.equal(grown.length, 3);
assert.equal(grown[1], two);
assert.notEqual(grown, previous);
assert.deepEqual(keepUnchangedMessages(previous, [message("2", "world")]), [two], "a deleted row is dropped");

// Nothing shown yet: nothing to draw at once.
assert.equal(cachedMariThread(null), null);

rememberMariThread("a", previous);
// No arrival to route: the thread she showed last.
assert.equal(cachedMariThread(null)?.chatId, "a");
const general = { context: { key: "general" } };
// An arrival to route, but no Chats list read yet: wait for the routing.
assert.equal(cachedMariThread(general), null);

const day = (n: number) => new Date(Date.UTC(2026, 9, n)).toISOString();
rememberMariThreads([
  { id: "a", metadata: { mariContextKey: "general" }, lastMessageAt: day(2), createdAt: day(1) },
  { id: "b", metadata: { mariContextKey: "character:c1" }, lastMessageAt: day(3), createdAt: day(1) },
]);
// The routing would keep her in "a" for Home.
assert.equal(cachedMariThread(general)?.chatId, "a");
// From the character's editor it would move to "b": do not flash "a" first.
assert.equal(cachedMariThread({ context: { key: "character:c1" } }), null);
// "Continue here" picked earlier for this context wins, as in the routing.
assert.equal(cachedMariThread({ context: { key: "character:c1" }, continuedThereId: "a" })?.chatId, "a");
// A context with no thread asks about the most recent one ("b"), not "a".
assert.equal(cachedMariThread({ context: { key: "lorebook:l1" } }), null);
