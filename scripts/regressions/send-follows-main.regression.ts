import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A chat without its own Model follows Main, so Send must not demand chat.connectionId when a Main exists.
// Source check: the send handler is too tied to the composer's state to run headless.
const input = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatInput.tsx", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const guard = input.slice(
  input.indexOf("chat && !chat.connectionId"),
  input.indexOf("itLooksLikeYouHaventConnectedAnyModel"),
);
assert.match(guard, /isDefault/, "The no-connection guard must let a chat that follows Main send");
console.log("Send follows Main.");
