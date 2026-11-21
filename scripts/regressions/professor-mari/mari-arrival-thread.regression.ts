// Opening Professor Mari from Home (or any screen without a subject of its own) lands in the thread you were last in.
// Before: it picked the newest thread *about* "general", so when the latest thread began in an editor or a chat, Home
// opened an older one and kept opening it.
import assert from "node:assert/strict";
import { chooseMariThread, readMariThread } from "../../../packages/client/src/lib/mari-arrival.js";

const chat = (id: string, lastMessageAt: string | null, metadata: Record<string, unknown>) => ({
  id,
  lastMessageAt,
  createdAt: "2026-11-01T00:00:00.000Z",
  metadata: JSON.stringify({ internalAssistant: "professor-mari", ...metadata }),
});

const threads = [
  chat("old-general", "2026-11-10T10:00:00.000Z", { professorMariActive: false, professorMariArchived: true }),
  chat("newer-general", "2026-11-12T10:00:00.000Z", { professorMariActive: false, professorMariArchived: true }),
  chat("from-editor", "2026-11-20T10:00:00.000Z", {
    professorMariActive: true,
    professorMariArchived: false,
    mariContextKey: "character:elara",
  }),
].map(readMariThread);

assert.equal(threads[2]!.active, true);
assert.deepEqual(chooseMariThread({ threads, contextKey: "general" }), { kind: "continue", chatId: "from-editor" });

// Switched back to an older thread: that is where Home opens next.
const switched = threads.map((thread) => ({ ...thread, active: thread.id === "old-general" }));
assert.deepEqual(chooseMariThread({ threads: switched, contextKey: "general" }), {
  kind: "continue",
  chatId: "old-general",
});

// No active flag (an old install): the most recent conversation.
const none = threads.map((thread) => ({ ...thread, active: false }));
assert.deepEqual(chooseMariThread({ threads: none, contextKey: "general" }), {
  kind: "continue",
  chatId: "from-editor",
});

// Screens with a subject keep their own thread, and ask when they have none.
assert.deepEqual(chooseMariThread({ threads: switched, contextKey: "character:elara" }), {
  kind: "continue",
  chatId: "from-editor",
});
assert.deepEqual(chooseMariThread({ threads, contextKey: "lorebook:eldoria" }), {
  kind: "ask",
  recentChatId: "from-editor",
});
assert.deepEqual(chooseMariThread({ threads: [], contextKey: "general" }), { kind: "new" });
console.log("mari-arrival-thread: ok");
