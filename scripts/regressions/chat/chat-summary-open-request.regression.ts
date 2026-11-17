// A Chat Summary open request names the chat it is for, so only that chat's settings open it.
import assert from "node:assert/strict";

const target = new EventTarget();
Object.defineProperty(globalThis, "window", { configurable: true, value: target });
const { CHAT_SUMMARY_OPEN_REQUEST_EVENT, requestChatSummaryOpen } =
  await import("../../../packages/client/src/lib/chat-floating-ui-events.js");

const received: unknown[] = [];
target.addEventListener(CHAT_SUMMARY_OPEN_REQUEST_EVENT, (event) => received.push((event as CustomEvent).detail));
requestChatSummaryOpen("chat-42");
assert.deepEqual(received, [{ chatId: "chat-42" }], "Summary requests must carry the target chat ID");
