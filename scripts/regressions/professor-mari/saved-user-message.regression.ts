import assert from "node:assert/strict";

import type { Message } from "@marinara-engine/shared";
import { findSavedUserMessage } from "../../../packages/client/src/components/chat/mari/mari-tool-presentation.js";

const message = (id: string, role: Message["role"], content: string, extra: Record<string, unknown> = {}) =>
  ({ id, chatId: "c", role, content, characterId: null, activeSwipeIndex: 0, createdAt: "", extra }) as Message;

const older = message("u1", "user", "Older question");
const answer = message("a1", "assistant", "Older answer");

// Saved: Retry reuses it instead of sending your question twice.
assert.equal(findSavedUserMessage([older, answer, message("u2", "user", "Ask")], "Ask")?.id, "u2");
// F3: a failed later round leaves her partial reply last; your question is still found behind it.
const partial = message("a2", "assistant", "Half", { mariRunError: { message: "Timed out" } });
assert.equal(findSavedUserMessage([older, message("u2", "user", "Ask"), partial], "Ask")?.id, "u2");
// Never saved (refused before the run, e.g. no admin secret): the composer gets your message back.
assert.equal(findSavedUserMessage([older, answer], "Ask"), undefined);
assert.equal(findSavedUserMessage([], "Ask"), undefined);
assert.equal(findSavedUserMessage(undefined, "Ask"), undefined);

console.log("professor-mari saved user message regression passed");
