// Chat Settings drawer behaviour that no browser test checks yet:
// - the Group Chat section shows only for a chat with more than one character, in a mode whose settings offer it;
// - in Conversation it hides the Roleplay-only Name Prefix History switch, and it warns that individual replies can
//   use many tokens;
// - the Long-Term Memory card's settings link waits for the drawer's guarded close, then remembers the way back;
// - Lorebook Keeper's action buttons stack in a narrow drawer.
// Reads component source; replacing these needs browser tests. The drawer's sections per mode, its close guard and
// the Secret Plot interval are covered in e2e/chat-settings-sections.e2e.ts, e2e/chat-settings-agent-cards.e2e.ts and
// e2e/core-flows.e2e.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
console.info("Chat Settings drawer checks passed.");
