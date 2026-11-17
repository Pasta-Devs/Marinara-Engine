// Where context usage shows: inside the connection switcher in Conversation, nowhere in the Game input, and in the
// configured chat chrome colours. Reads component source; replacing these needs browser tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const contextBudgetConversationInputSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ConversationInput.tsx", import.meta.url),
  "utf8",
);
const contextBudgetGameInputSource = readFileSync(
  new URL("../../../packages/client/src/components/game/GameInput.tsx", import.meta.url),
  "utf8",
);
const contextBudgetIndicatorSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ContextBudgetIndicator.tsx", import.meta.url),
  "utf8",
);
assert.equal(
  contextBudgetIndicatorSource.match(/var\(--marinara-chat-chrome-text\)/gu)?.length,
  1,
  "non-accent context usage bars must use the configured chat chrome text color",
);
assert.match(
  contextBudgetIndicatorSource,
  /stroke="var\(--marinara-chat-chrome-accent\)"/u,
  "Context usage gauge rings must use the configured chat chrome accent color",
);
assert.match(contextBudgetIndicatorSource, /text-\[var\(--marinara-chat-chrome-panel-muted\)\]/u);
assert.match(contextBudgetIndicatorSource, /text-\[var\(--marinara-chat-chrome-panel-text\)\]/u);
assert.doesNotMatch(contextBudgetIndicatorSource, /professorMari/u);
assert.doesNotMatch(
  contextBudgetConversationInputSource,
  /<ContextBudgetIndicator/u,
  "Conversation context usage must stay inside the connection switcher",
);
assert.doesNotMatch(
  contextBudgetGameInputSource,
  /ContextBudget|QuickConnectionSwitcher/u,
  "Game input must leave context usage in chat settings",
);
