// Chat Settings drawer behaviour that no browser test checks yet:
// - the Group Chat section shows only for a chat with more than one character, in a mode whose settings offer it;
// - in Conversation it hides the Roleplay-only Name Prefix History switch, and it warns that individual replies can
//   use many tokens;
// - the Long-Term Memory card's settings link waits for the drawer's guarded close, then remembers the way back;
// - Lorebook Keeper's action buttons stack in a narrow drawer;
// - a custom agent's image settings merge quick changes, and removing the agent waits for its queued writes.
// Reads component source; replacing these needs browser tests. The write queue itself is run directly. The drawer's sections per mode, its close guard and
// the Secret Plot interval are covered in e2e/chat-settings-sections.e2e.ts, e2e/chat-settings-agent-cards.e2e.ts and
// e2e/core-flows.e2e.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSerializedMutationQueue } from "../../../packages/client/src/lib/serialized-mutation-queue.js";

const read = (path: string) =>
  readFileSync(new URL(`../../../packages/client/src/features/chat-settings/${path}`, import.meta.url), "utf8");
const drawerSource = read("ChatSettingsDrawer.tsx");
const groupChatSectionSource = read("sections/GroupChatSection.tsx");

const groupChatUseIndex = drawerSource.indexOf("<GroupChatSection");
assert.notEqual(groupChatUseIndex, -1, "Chat Settings Drawer must retain the Group Chat section");
const groupChatVisibilitySource = drawerSource.slice(groupChatUseIndex, groupChatUseIndex + 600);
assert.match(
  groupChatVisibilitySource,
  /chatCharIds\.length\s*>\s*1/u,
  "pre-existing multi-character Conversation chats must retain the Group Chat character-count gate",
);
assert.match(
  groupChatVisibilitySource,
  /\bshowGroupChatControls\b/u,
  "Group Chat visibility must consume the settings-surface policy",
);
assert.match(
  groupChatSectionSource,
  /\{!isConversation && \(\s*<SettingsSwitch[\s\S]{0,700}ui\.chat\.chatsettingsdrawer\.namePrefixHistory/u,
  "Conversation group settings should not show the roleplay-only Name Prefix History toggle",
);
assert.match(
  groupChatSectionSource,
  /ui\.chat\.chatsettingsdrawer\.individualRepliesCanUseManyTokens/u,
  "Conversation group-token warning must remain wired through localization",
);

assert.match(
  read("agents/LongTermMemorySettings.tsx"),
  /onOpenAgentSettings:[\s\S]{0,250}requestClose\(\)\.then\(\(closed\)[\s\S]{0,150}if \(closed\) \{\s+rememberSettingsReturn\(\);\s+useUIStore\.getState\(\)\.openAgentDetail\("long-term-memory"\)/u,
  "Long-Term Memory settings navigation must wait for the guarded drawer close, then record the Chat Settings return",
);

assert.match(
  read("agents/LorebookKeeperSettings.tsx"),
  // Chat Settings content follows the window's width (container queries) since #7036.
  /flex w-full min-w-0 flex-col items-stretch gap-1\.5 @lg:w-auto @lg:shrink-0 @lg:flex-row/u,
  "Lorebook Keeper actions must stack inside their mobile settings card",
);

// A custom agent's image connection and style are saved as one map per chat, one write at a time.
const chatAgentsSource = read("agents/use-chat-agents.ts");
const imageSettingUpdateSource =
  /const updateCustomAgentImageSetting = useCallback\([\s\S]*?\n  const updateCustomAgentImageConnection/u.exec(
    chatAgentsSource,
  )?.[0] ?? "";
assert.match(
  imageSettingUpdateSource,
  /setCustomAgentImageSettingsDraft\(\(current\) => \(\{[\s\S]*current\?\.chatId === chat\.id \? current\.patch : \{\}[\s\S]*\[agentId\]: hasAgentSettings \? agentSettings : null/u,
  "Rapid custom-agent connection and style changes must merge into one visible local draft",
);
assert.match(
  imageSettingUpdateSource,
  /if \(removingAgentImageSettingsRef\.current\.has\(agentId\)\) return;/u,
  "Selector changes for an agent being removed must not enqueue another full-map write",
);
const toggleAgentSource =
  /const toggleAgent = async[\s\S]*?\n  const removeAgentFromMenu/u.exec(chatAgentsSource)?.[0] ?? "";
assert.match(
  toggleAgentSource,
  /await flushPendingCustomAgentImageSettings\(\)[\s\S]*await customAgentImageSettingsWriteQueueRef\.current\.waitForIdle\(\)[\s\S]*const latestImageSettings = readLatestCustomAgentImageSettings\(\)[\s\S]*delete next\[agentId\]/u,
  "Removing an agent must drain queued image writes before deleting that agent's override",
);
assert.match(
  toggleAgentSource,
  /removingAgentImageSettingsRef\.current\.add\(agentId\)[\s\S]*customAgentImageSettingsWriteQueueRef\.current\.enqueue\(saveAgentSelection\)[\s\S]*finally \{[\s\S]*removingAgentImageSettingsRef\.current\.delete\(agentId\)/u,
  "Agent removal must be terminal in the image-settings queue and unblock the selector afterward",
);

// The queue those writes go through runs each one only after the one before it has finished.
const serializedWrites = createSerializedMutationQueue();
const writeOrder: string[] = [];
let releaseFirstWrite!: () => void;
const firstWriteGate = new Promise<void>((resolve) => {
  releaseFirstWrite = resolve;
});
const firstWrite = serializedWrites.enqueue(async () => {
  writeOrder.push("first:start");
  await firstWriteGate;
  writeOrder.push("first:end");
});
const secondWrite = serializedWrites.enqueue(async () => {
  writeOrder.push("second");
});
await Promise.resolve();
assert.deepEqual(writeOrder, ["first:start"], "A delayed older metadata write must hold newer writes in order");
releaseFirstWrite();
await Promise.all([firstWrite, secondWrite, serializedWrites.waitForIdle()]);
assert.deepEqual(writeOrder, ["first:start", "first:end", "second"]);
console.info("Chat Settings drawer checks passed.");
