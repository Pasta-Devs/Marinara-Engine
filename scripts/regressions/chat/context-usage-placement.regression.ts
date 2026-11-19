// Where context usage shows: inside the connection switcher in Conversation and Roleplay, in Chat Settings' Connection section
// rather than the input in Game, and in the configured chat chrome colours. Reads component source; replacing these needs browser tests.
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
const chatSettingsSource = (path: string) =>
  readFileSync(new URL(`../../../packages/client/src/features/chat-settings/${path}`, import.meta.url), "utf8");
assert.match(
  chatSettingsSource("ChatSettingsDrawer.tsx"),
  /<ConnectionSection[\s\S]{0,240}contextBudget=\{gameContextBudget\}/u,
  "Game chat settings must pass measured usage to the connection section",
);
assert.match(
  chatSettingsSource("sections/ConnectionSection.tsx"),
  /\{contextBudget && <ContextBudgetIndicator budget=\{contextBudget\} \/>\}/u,
  "Game connection settings must show measured context usage",
);
// Roleplay keeps it in the connection switcher too, on desktop and phone, with the larger gauge.
const clientSource = (path: string) =>
  readFileSync(new URL(`../../../packages/client/src/components/chat/${path}`, import.meta.url), "utf8");
assert.doesNotMatch(
  clientSource("ChatInput.tsx"),
  /<ContextBudgetIndicator/u,
  "Roleplay context usage must stay inside the connection switcher",
);
for (const [name, path] of [
  ["desktop connection switcher", "QuickConnectionSwitcher.tsx"],
  ["mobile connection switcher", "QuickSwitcherMobile.tsx"],
] as const) {
  const source = clientSource(path);
  assert.match(source, /<ContextBudgetIndicator budget=\{contextBudget\}/u, `${name} must show usage in its popup`);
  assert.match(source, /relative flex h-\[1\.875rem\] w-\[1\.875rem\]/u, `${name} must use the larger context gauge`);
}
