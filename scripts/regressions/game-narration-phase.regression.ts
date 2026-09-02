// Game Mode keeps `isStreaming` true past the last narration token, because the
// same request also carries post-processing, the message refresh, and scene
// analysis. The status line therefore reads a separate phase flag, which
// `message_saved` sets and every generation teardown path clears. If any of
// those clears is lost, the status pill sticks on "Preparing scene…" for the
// next turn — including its writing phase.
import assert from "node:assert/strict";

const { useChatStore } = await import("../../packages/client/src/stores/chat.store.js");

const chatId = "game-narration-phase-chat";
const otherChatId = "game-narration-phase-other";
const store = useChatStore.getState();

const isSaved = (id: string): boolean => useChatStore.getState().narrationSavedChatIds.has(id);

assert.equal(isSaved(chatId), false, "a chat starts outside the post-writing phase");

store.setNarrationSaved(chatId, true);
assert.equal(isSaved(chatId), true, "message_saved moves the turn past the writing phase");
assert.equal(isSaved(otherChatId), false, "the phase is scoped to one chat");

// ── A new generation for the chat resets the phase ──
store.setAbortController(chatId, new AbortController());
assert.equal(isSaved(chatId), false, "starting the next generation returns to the writing phase");
useChatStore.getState().setAbortController(chatId, null);

// ── Normal teardown clears it ──
store.setNarrationSaved(chatId, true);
useChatStore.getState().clearPerChatState(chatId);
assert.equal(isSaved(chatId), false, "per-chat cleanup clears the phase");

// ── Explicit reset clears it ──
store.setNarrationSaved(chatId, true);
store.setNarrationSaved(chatId, false);
assert.equal(isSaved(chatId), false, "the phase can be cleared directly");

console.log("game-narration-phase regression passed");
