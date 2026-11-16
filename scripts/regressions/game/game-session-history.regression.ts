// How many tokens a game session's history takes.
import assert from "node:assert/strict";
import { estimateGameSessionHistoryTokens } from "../../../packages/client/src/lib/game-session-history.js";

const gameHistoryMessage = (content: string, extra?: unknown) => ({ content, extra });
const objectGameHistoryMetadata = [gameHistoryMessage("ignored", { tokenCount: 37 })];
const jsonGameHistoryMetadata = [gameHistoryMessage("ignored", '{"tokenCount":37}')];
assert.equal(estimateGameSessionHistoryTokens(objectGameHistoryMetadata), 37);
assert.equal(
  estimateGameSessionHistoryTokens(jsonGameHistoryMetadata),
  estimateGameSessionHistoryTokens(objectGameHistoryMetadata),
  "JSON-string metadata must use the same valid token count as object metadata",
);
const latestObjectGameHistoryMarker = [
  gameHistoryMessage("ignored", { tokenCount: 101 }),
  gameHistoryMessage("ignored", { tokenCount: 23, isConversationStart: true }),
  gameHistoryMessage("ignored", { tokenCount: 19 }),
  gameHistoryMessage("ignored", { tokenCount: 7, isConversationStart: true }),
];
const latestJsonGameHistoryMarker = [
  gameHistoryMessage("ignored", '{"tokenCount":101}'),
  gameHistoryMessage("ignored", '{"tokenCount":23,"isConversationStart":true}'),
  gameHistoryMessage("ignored", '{"tokenCount":19}'),
  gameHistoryMessage("ignored", '{"tokenCount":7,"isConversationStart":true}'),
];
assert.equal(estimateGameSessionHistoryTokens(latestObjectGameHistoryMarker), 7);
assert.equal(
  estimateGameSessionHistoryTokens(latestJsonGameHistoryMarker),
  estimateGameSessionHistoryTokens(latestObjectGameHistoryMarker),
  "the latest JSON-string conversation-start marker must determine session history",
);
const falseStringObjectGameHistoryMarker = [
  gameHistoryMessage("ignored", { tokenCount: 23, isConversationStart: true }),
  gameHistoryMessage("ignored", { tokenCount: 19 }),
  gameHistoryMessage("ignored", { tokenCount: 7, isConversationStart: "false" }),
];
const falseStringJsonGameHistoryMarker = [
  gameHistoryMessage("ignored", '{"tokenCount":23,"isConversationStart":true}'),
  gameHistoryMessage("ignored", '{"tokenCount":19}'),
  gameHistoryMessage("ignored", '{"tokenCount":7,"isConversationStart":"false"}'),
];
assert.equal(
  estimateGameSessionHistoryTokens(falseStringObjectGameHistoryMarker),
  49,
  "a string false-valued object marker must not start a Game session",
);
assert.equal(
  estimateGameSessionHistoryTokens(falseStringJsonGameHistoryMarker),
  49,
  "a string false-valued JSON marker must not start a Game session",
);
const fallbackGameHistoryMessages = [
  gameHistoryMessage("one two", "{not valid JSON"),
  gameHistoryMessage("three four"),
];
assert.equal(
  estimateGameSessionHistoryTokens(fallbackGameHistoryMessages),
  14,
  "malformed and absent metadata must retain the full history with text estimates",
);
