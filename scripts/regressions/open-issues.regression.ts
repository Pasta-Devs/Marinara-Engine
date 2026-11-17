import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatMode } from "../../packages/shared/src/types/chat.js";
import { chatModeSchema } from "../../packages/shared/src/schemas/chat.schema.js";
import { validatePullRequestTriage } from "../validate-pr-triage.mjs";
import { createSerializedMutationQueue } from "../../packages/client/src/lib/serialized-mutation-queue.js";
import {
  CUSTOM_AGENT_RESULT_EXAMPLES,
  CUSTOM_AGENT_RESULT_TYPE_IDS,
} from "../../packages/client/src/lib/custom-agent-result-examples.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
import { CHAT_SETTINGS_SURFACES } from "../../packages/client/src/features/chat-settings/chat-settings-surfaces.js";
import {
  formatLorebookWriteApprovalText,
  parseLorebookWriteApprovalText,
} from "../../packages/server/src/routes/generate/agent-write-approval.js";
import {
  persistLorebookKeeperUpdates,
  readLorebookKeeperUpdateOrder,
  resolveLorebookKeeperTarget,
} from "../../packages/server/src/routes/generate/lorebook-keeper-utils.js";
import { buildSceneAnalyzerUserPrompt } from "../../packages/server/src/services/sidecar/scene-analyzer.js";
import { postProcessSceneResult } from "../../packages/server/src/services/sidecar/scene-postprocess.js";
import { explicitlyRequestsTextRewrite } from "../../packages/server/src/services/generation/prose-guardian-settings.js";
import { ttsConfigSchema } from "../../packages/shared/src/types/tts.js";
import {
  mergeGeneratedChatMacroVariables,
  normalizeChatMacroVariables,
} from "../../packages/server/src/services/prompt/macro-context.js";
import { HOME_CHAT_MODE_ACCENTS } from "../../packages/client/src/lib/home-chat-mode-style.js";

assert.deepEqual(HOME_CHAT_MODE_ACCENTS, {
  conversation: "oklch(0.79 0.16 205)",
  roleplay: "oklch(0.76 0.19 52)",
  game: "var(--marinara-mode-game-accent)",
});

const lorebookEnglishLocale = JSON.parse(
  readFileSync(join(REPOSITORY_ROOT, "packages/client/src/localization/locales/en.json"), "utf8"),
) as Record<string, unknown>;

const expectedChatModeSurfaces = {
  conversation: {
    showSettingsProfiles: true,
    promptSettingsSurface: "conversation",
    agentSettingsSurface: "conversation",
    showGroupChatControls: true,
  },
  roleplay: {
    showSettingsProfiles: true,
    promptSettingsSurface: "roleplay",
    agentSettingsSurface: "generation",
    showGroupChatControls: true,
  },
  game: {
    showSettingsProfiles: false,
    promptSettingsSurface: "game",
    agentSettingsSurface: "generation",
    showGroupChatControls: false,
  },
} as const satisfies Record<
  ChatMode,
  {
    showSettingsProfiles: boolean;
    promptSettingsSurface: "conversation" | "roleplay" | "game";
    agentSettingsSurface: "conversation" | "generation";
    showGroupChatControls: boolean;
  }
>;
assert.deepEqual(chatModeSchema.options, ["conversation", "roleplay", "game"]);
for (const mode of Object.keys(expectedChatModeSurfaces) as ChatMode[]) {
  const modeSettingsSurfaces = CHAT_SETTINGS_SURFACES[mode];
  assert.deepEqual(
    {
      showSettingsProfiles: modeSettingsSurfaces.showSettingsProfiles,
      promptSettingsSurface: modeSettingsSurfaces.promptSettingsSurface,
      agentSettingsSurface: modeSettingsSurfaces.agentSettingsSurface,
      showGroupChatControls: modeSettingsSurfaces.showGroupChatControls,
    },
    expectedChatModeSurfaces[mode],
    `Chat mode ${mode} must expose the expected settings surfaces`,
  );
}
assert.deepEqual(Object.keys(CHAT_SETTINGS_SURFACES), ["conversation", "roleplay", "game"]);

// Issue #5225 — optional integer order survives automatic and approval-gated writes.
{
  for (const resultType of CUSTOM_AGENT_RESULT_TYPE_IDS) {
    const example = CUSTOM_AGENT_RESULT_EXAMPLES[resultType];
    assert.ok(example.value.trim(), `${resultType} must expose a non-empty custom-agent response example`);
    if (example.format === "json") {
      const parsed = JSON.parse(example.value);
      assert.ok(parsed && typeof parsed === "object" && !Array.isArray(parsed));
    }
  }
  const lorebookResultExample = JSON.parse(CUSTOM_AGENT_RESULT_EXAMPLES.lorebook_update.value);
  assert.equal(lorebookResultExample.updates[0]?.order, 200);
  const agentEditorSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/agents/AgentEditor.tsx"),
    "utf8",
  );
  const customResultInitializer =
    /const customResultExample =[^;]{0,400}CUSTOM_AGENT_RESULT_EXAMPLES\[localResultType\]/u;
  assert.doesNotMatch(
    "const customResultExample = null; const unrelated = CUSTOM_AGENT_RESULT_EXAMPLES[localResultType];",
    customResultInitializer,
    "A later unrelated lookup must not satisfy the initializer check",
  );
  assert.match(
    agentEditorSource,
    customResultInitializer,
    "The prompt preview must select the response example for the active result type",
  );
  assert.match(
    agentEditorSource,
    /isCustomAgent \|\| isNewCustomAgent[\s\S]{0,160}customPromptPlaceholder/u,
    "The custom-agent prompt placeholder must follow the selected result type's response example",
  );

  assert.equal(readLorebookKeeperUpdateOrder({ order: 200 }), 200);
  assert.equal(readLorebookKeeperUpdateOrder({ entry: { order: -10 } }), -10);
  assert.equal(readLorebookKeeperUpdateOrder({ order: "200" }), undefined);
  assert.equal(readLorebookKeeperUpdateOrder({ order: 1.5 }), undefined);
  assert.equal(readLorebookKeeperUpdateOrder({ order: Number.MAX_SAFE_INTEGER + 1 }), undefined);

  const approvalText = formatLorebookWriteApprovalText([
    {
      name: "Ordered Memory",
      keys: ["memory"],
      tag: "event",
      targetLorebook: "world",
      order: 200,
      content: "A durable memory.",
    },
  ]);
  assert.match(approvalText, /\nOrder: 200\n/u);
  assert.match(approvalText, /\nLorebook: world\n/u);
  assert.deepEqual(parseLorebookWriteApprovalText(approvalText), [
    {
      action: "append",
      name: "Ordered Memory",
      keys: ["memory"],
      tag: "event",
      targetLorebook: "world",
      order: 200,
      content: "A durable memory.",
    },
  ]);
  assert.equal(
    parseLorebookWriteApprovalText(
      ["### Signed Order", "Keys: signed", "Tag:", "Order: +200", "", "Keep the sign."].join("\n"),
    )[0]?.order,
    200,
    "Approval edits must accept an explicit leading plus sign on integer orders",
  );

  const updatedEntries: Array<{ id: string; changes: Record<string, unknown> }> = [];
  const createdEntries: Array<Record<string, unknown>> = [];
  const lorebooksStore = {
    listEntries: async () => [
      {
        id: "existing-entry",
        name: "Existing Memory",
        content: "Existing fact.",
        keys: ["existing"],
        tag: "event",
        locked: false,
        order: 100,
      },
    ],
    updateEntry: async (id: string, changes: Record<string, unknown>) => {
      updatedEntries.push({ id, changes });
      return { id, name: "Existing Memory", ...changes };
    },
    createEntry: async (input: Record<string, unknown>) => {
      createdEntries.push(input);
      return { id: `created-${createdEntries.length}`, ...input };
    },
  };
  await persistLorebookKeeperUpdates({
    lorebooksStore: lorebooksStore as any,
    chatId: "chat-5225",
    chatName: "Order proof",
    preferredTargetLorebookId: "lorebook-5225",
    writableLorebookIds: ["lorebook-5225"],
    updates: [
      { entryName: "Existing Memory", newFacts: ["New fact."], order: 200 },
      { entryName: "New Memory", content: "Created fact.", order: 300 },
      { entryName: "Default Memory", content: "Uses storage default.", order: "400" },
    ],
  });
  assert.equal(updatedEntries[0]?.id, "existing-entry");
  assert.equal(updatedEntries[0]?.changes.order, 200);
  assert.equal(createdEntries[0]?.order, 300);
  assert.equal(Object.hasOwn(createdEntries[1] ?? {}, "order"), false);

  const cancelledPersistence = new AbortController();
  let cancelledEntryWrites = 0;
  await assert.rejects(
    persistLorebookKeeperUpdates({
      lorebooksStore: {
        listEntries: async () => {
          cancelledPersistence.abort();
          return [];
        },
        createEntry: async () => {
          cancelledEntryWrites += 1;
          return null;
        },
      } as any,
      chatId: "chat-cancelled",
      chatName: "Cancelled proof",
      preferredTargetLorebookId: "book-cancelled",
      writableLorebookIds: ["book-cancelled"],
      updates: [{ entryName: "Must not persist", content: "Cancelled fact." }],
      signal: cancelledPersistence.signal,
    }),
    /aborted/iu,
  );
  assert.equal(cancelledEntryWrites, 0, "Cancellation after an awaited read must stop the following lorebook write");

  const routedEntries: Array<Record<string, unknown>> = [];
  const createdBooks: Array<Record<string, unknown>> = [];
  const routedBooks: Array<Record<string, unknown>> = [{ id: "book-world", name: "My World — World Lore" }];
  const routedStore = {
    list: async () => routedBooks,
    create: async (input: Record<string, unknown>) => {
      createdBooks.push(input);
      const created = { id: "book-scene", ...input };
      routedBooks.push(created);
      return created;
    },
    listEntries: async () => [],
    createEntry: async (input: Record<string, unknown>) => {
      routedEntries.push(input);
      return { id: `routed-${routedEntries.length}`, ...input };
    },
    updateEntry: async () => null,
  };
  await persistLorebookKeeperUpdates({
    lorebooksStore: routedStore as any,
    chatId: "chat-439",
    chatName: "Campaign",
    preferredTargetLorebookId: "book-world",
    writableLorebookIds: ["book-world"],
    writableLorebooks: [{ id: "book-world", name: "My World — World Lore" }],
    lorebookNamingScheme: { scene: "[WorldName] — Scene Log" },
    worldName: "Campaign",
    updates: [
      { targetLorebook: "My World — World Lore", entryName: "Magic", content: "World fact." },
      { targetLorebook: "scene", entryName: "Tavern", content: "Scene fact." },
      { entryName: "Fallback", content: "Default-book fact." },
    ],
  });
  assert.deepEqual(
    routedEntries.map((entry) => entry.lorebookId),
    ["book-world", "book-scene", "book-world"],
    "exact names and aliases route independently while omitted targets retain the default book",
  );
  assert.equal(createdBooks[0]?.name, "Campaign — Scene Log", "a missing configured alias creates its named book");
  assert.equal(createdBooks[0]?.chatId, "chat-439", "auto-created routing books link to the active chat");
  const nextRunTarget = await resolveLorebookKeeperTarget({
    lorebooksStore: routedStore as any,
    chatId: "chat-439",
    characterIds: [],
    activeLorebookIds: [],
    preferredTargetLorebookId: "book-world",
  });
  assert.ok(
    nextRunTarget.writableLorebookIds.includes("book-scene"),
    "a routing book created for one run must remain writable on the next run instead of being duplicated",
  );
}

validatePullRequestTriage();

const termuxLauncher = readFileSync(new URL("../../start-termux.sh", import.meta.url), "utf8");
assert.doesNotMatch(termuxLauncher, /run_pnpm install --force/u);
assert.match(termuxLauncher, /run_pnpm store prune/u);
assert.match(termuxLauncher, /TERMUX_REBUILD_REQUIRED/u);
assert.doesNotMatch(termuxLauncher, /--max-old-space-size=2048/u);
assert.match(
  termuxLauncher,
  /has_explicit_node_heap_limit\(\)[\s\S]*NODE_OPTIONS_VALUE[\s\S]*const heapOption = \/\^--max[\s\S]*resolve_default_node_heap_mb\(\)[\s\S]*heap_mb=1024[\s\S]*heap_mb=1536[\s\S]*if ! has_explicit_node_heap_limit; then[\s\S]*--max-old-space-size=\$\{MARINARA_TERMUX_HEAP_MB\}/u,
  "Termux must parse complete heap-option tokens before applying its bounded profile-aware default",
);
for (const buildEntry of ["packages/shared/dist/constants/defaults.js", "packages/server/dist/index.js"]) {
  assert.ok(
    termuxLauncher.includes(`if [ ! -f "${buildEntry}" ]; then`),
    `Termux must rebuild when ${buildEntry} is missing`,
  );
}
const termuxClientBuildBlock = termuxLauncher
  .split("if ! node scripts/check-client-build.mjs; then\n")[1]
  ?.split("\nfi")[0];
assert.ok(termuxClientBuildBlock, "Termux must handle an incomplete client build");
assert.equal(
  termuxClientBuildBlock.match(/build_termux_client/gu)?.length,
  2,
  "Initial build and retry must use the bounded build heap",
);
const termuxClientBuildHelper = termuxLauncher.split("build_termux_client() (")[1]?.split("\n)")[0];
assert.ok(termuxClientBuildHelper, "Termux must define the isolated client build helper");
assert.match(termuxClientBuildHelper, /MARINARA_LOW_MEMORY_BUILD=1 run_pnpm --filter @marinara-engine\/client build/u);
assert.match(
  termuxClientBuildBlock,
  /    node scripts\/check-client-build\.mjs$/u,
  "Termux must rebuild and recheck incomplete client assets, including a missing index",
);

const sharedPackageJson = JSON.parse(
  readFileSync(new URL("../../packages/shared/package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };
const preserveSharedBuild = sharedPackageJson.scripts?.["build:preserve"] ?? "";
assert.match(preserveSharedBuild, /tsconfig\.tsbuildinfo/u);
assert.doesNotMatch(preserveSharedBuild, /\bdist\b/u);
const conversationGroupSettingsSource = readFileSync(
  new URL("../../packages/client/src/features/chat-settings/ChatSettingsDrawer.tsx", import.meta.url),
  "utf8",
);
const foregroundAutonomousSource = readFileSync(
  new URL("../../packages/client/src/hooks/use-autonomous-messaging.ts", import.meta.url),
  "utf8",
);
const backgroundAutonomousSource = readFileSync(
  new URL("../../packages/client/src/hooks/use-background-autonomous.ts", import.meta.url),
  "utf8",
);
const serverAutonomousSchedulerSource = readFileSync(
  new URL("../../packages/server/src/services/conversation/server-autonomous-scheduler.service.ts", import.meta.url),
  "utf8",
);
const professorMariHomeSource = readFileSync(
  new URL("../../packages/client/src/components/chat/HomeProfessorMariChat.tsx", import.meta.url),
  "utf8",
);
// Slice 82: the chat's parts live in components/chat/mari/; "nowhere" and count checks read all of them.
const mariChatDir = new URL("../../packages/client/src/components/chat/mari/", import.meta.url);
const mariChatPart = (name: string) => readFileSync(new URL(name, mariChatDir), "utf8");
const mariChatAllSource = [professorMariHomeSource, ...readdirSync(mariChatDir).map(mariChatPart)].join("\n");
const contextBudgetChatInputSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatInput.tsx", import.meta.url),
  "utf8",
);
const contextBudgetChatSettingsSource = readFileSync(
  new URL("../../packages/client/src/features/chat-settings/ChatSettingsDrawer.tsx", import.meta.url),
  "utf8",
);
const contextBudgetConnectionSectionSource = readFileSync(
  new URL("../../packages/client/src/features/chat-settings/sections/ConnectionSection.tsx", import.meta.url),
  "utf8",
);
const quickConnectionSwitcherSource = readFileSync(
  new URL("../../packages/client/src/components/chat/QuickConnectionSwitcher.tsx", import.meta.url),
  "utf8",
);
const quickSwitcherMobileSource = readFileSync(
  new URL("../../packages/client/src/components/chat/QuickSwitcherMobile.tsx", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  contextBudgetChatInputSource,
  /<ContextBudgetIndicator/u,
  "Roleplay context usage must stay inside the connection switcher",
);
assert.match(
  contextBudgetChatSettingsSource,
  /<ConnectionSection[\s\S]{0,240}contextBudget=\{gameContextBudget\}/u,
  "Game chat settings must pass measured usage to the connection section",
);
assert.match(
  contextBudgetConnectionSectionSource,
  /\{contextBudget && <ContextBudgetIndicator budget=\{contextBudget\} \/>\}/u,
  "Game connection settings must show measured context usage",
);
for (const [name, source] of [
  ["desktop connection switcher", quickConnectionSwitcherSource],
  ["mobile connection switcher", quickSwitcherMobileSource],
] as const) {
  assert.match(source, /<ContextBudgetIndicator budget=\{contextBudget\}/u, `${name} must show usage in its popup`);
  assert.match(source, /relative flex h-\[1\.875rem\] w-\[1\.875rem\]/u, `${name} must use the larger context gauge`);
}
// One composer since the floating-mode branch was removed (f27ce165b). Its keys route through
// composerKeyAction (#7913), which composer-triggers.regression.ts checks case by case.
assert.equal(
  mariChatAllSource.match(/composerKeyAction\(\{/gu)?.length,
  1,
  "Professor Mari's composer must route its keys through composerKeyAction",
);
assert.doesNotMatch(
  mariChatAllSource,
  /catch \(error\) \{[^}]*setDraft\(/u,
  "A failed or stopped Professor Mari send must not restore the submitted prompt to the composer",
);

// Clear Trackers is shared by every Agent activity section (Chat Settings, Trackers window, Tracker Panel).
assert.match(
  readFileSync(new URL("../../packages/client/src/hooks/use-agent-activity.ts", import.meta.url), "utf8"),
  /latestAssistantMessage[\s\S]{0,240}extra: \{ cyoaChoices: \[\] \}/u,
  "clearing Roleplay tracker state must also clear the persisted active CYOA prompt",
);
const themesRouteSource = readFileSync(
  new URL("../../packages/server/src/routes/themes.routes.ts", import.meta.url),
  "utf8",
);
const groupChatSectionSource = readFileSync(
  new URL("../../packages/client/src/features/chat-settings/sections/GroupChatSection.tsx", import.meta.url),
  "utf8",
);
for (const source of [conversationGroupSettingsSource, groupChatSectionSource]) {
  assert.doesNotMatch(source, /Reply When Mentioned/u);
  assert.doesNotMatch(source, /label="Cross-Chat Awareness"/u);
}
assert.match(
  groupChatSectionSource,
  /ui\.chat\.chatsettingsdrawer\.individualRepliesCanUseManyTokens/u,
  "Conversation group-token warning must remain wired through localization",
);
assert.match(
  groupChatSectionSource,
  /ui\.chat\.chatsettingsdrawer\.groupChat"/u,
  "the Group Chat section keeps its label",
);
const groupChatUseIndex = conversationGroupSettingsSource.indexOf("<GroupChatSection");
assert.notEqual(groupChatUseIndex, -1, "Chat Settings Drawer must retain the Group Chat section");
const groupChatVisibilitySource = conversationGroupSettingsSource.slice(groupChatUseIndex, groupChatUseIndex + 600);
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
  conversationGroupSettingsSource,
  // The close button also closes a pinned window: `force` defaults to true (#7036); a card link passes false (#8933).
  /if \(!\(await flushProseGuardianDrafts\(\)\)\) return false;[\s\S]{0,250}onClose\((?:\{ force(?:: true)? \})?\)[\s\S]{0,100}return true/u,
  "Closing Chat Settings must persist changed Prose Guardian preferences before unmounting the drawer",
);

await Promise.resolve();
assert.match(
  groupChatSectionSource,
  /\{!isConversation && \(\s*<SettingsSwitch[\s\S]{0,700}ui\.chat\.chatsettingsdrawer\.namePrefixHistory/u,
  "Conversation group settings should not show the roleplay-only Name Prefix History toggle",
);
assert.match(
  readFileSync(
    new URL("../../packages/client/src/features/chat-settings/agents/LongTermMemorySettings.tsx", import.meta.url),
    "utf8",
  ),
  /onOpenAgentSettings:[\s\S]{0,250}requestClose\(\)\.then\(\(closed\)[\s\S]{0,150}if \(closed\) \{\s+rememberSettingsReturn\(\);\s+useUIStore\.getState\(\)\.openAgentDetail\("long-term-memory"\)/u,
  "Long-Term Memory settings navigation must wait for the guarded drawer close, then record the Chat Settings return",
);
for (const [source, lane] of [
  [foregroundAutonomousSource, "foreground"],
  [backgroundAutonomousSource, "background"],
  [serverAutonomousSchedulerSource, "server scheduler"],
] as const) {
  assert.match(
    source,
    /forCharacterId: characterId/u,
    `Conversation ${lane} autonomous generation must target one character`,
  );
}
assert.equal(
  themesRouteSource.match(/requirePrivilegedAccess\(req, reply, \{ feature: "Theme install\/update\/delete" \}\)/gu)
    ?.length,
  3,
  "theme installation, editing, and deletion should remain privileged while activation works from mobile clients",
);
const activeThemeHandler = themesRouteSource.match(
  /app\.put\("\/active", async \(req, reply\) => \{([\s\S]*?)\n  \}\);/u,
)?.[1];
assert.ok(activeThemeHandler, "the active theme handler should remain available");
assert.match(activeThemeHandler, /const input = setActiveThemeSchema\.parse\(req\.body\);/u);
assert.doesNotMatch(
  activeThemeHandler,
  /requirePrivilegedAccess/u,
  "selecting an already-installed theme should not require privileged loopback access",
);

const agentEditorSource = readFileSync(
  new URL("../../packages/client/src/components/agents/AgentEditor.tsx", import.meta.url),
  "utf8",
);
const gameSurfaceSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
// Chat Settings' sections and agent cards live in their own folders, so read the drawer and both.
const chatSettingsDir = join(REPOSITORY_ROOT, "packages/client/src/features/chat-settings");
const chatSettingsDrawerSource = [
  join(chatSettingsDir, "ChatSettingsDrawer.tsx"),
  ...["sections", "agents"].flatMap((folder) =>
    readdirSync(join(chatSettingsDir, folder)).map((name) => join(chatSettingsDir, folder, name)),
  ),
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
// The drawer and the hook that holds Agents' state, for the checks that read only those two.
const drawerAndAgentsStateSource = ["ChatSettingsDrawer.tsx", "agents/use-chat-agents.ts"]
  .map((name) => readFileSync(join(chatSettingsDir, name), "utf8"))
  .join("\n");
// Roleplay and Game's Agents section, and the agent-card renderers it shares with Conversation.
const roleplayAgentsSectionSource = readFileSync(join(chatSettingsDir, "agents/RoleplayAgentsSection.tsx"), "utf8");
const agentSettingsRenderersSource = readFileSync(join(chatSettingsDir, "agents/agent-settings-renderers.tsx"), "utf8");
assert.match(
  agentEditorSource,
  /requiredAnyCapability:\s*\["edit_lorebooks",\s*"create_lorebooks"\]/u,
  "Lorebook Update must be configurable by create-only custom lorebook agents",
);
assert.match(
  chatSettingsDrawerSource,
  // Chat Settings content follows the window's width (container queries) since #7036.
  /flex w-full min-w-0 flex-col items-stretch gap-1\.5 @lg:w-auto @lg:shrink-0 @lg:flex-row/u,
  "Lorebook Keeper actions must stack inside their mobile settings card",
);
assert.match(
  chatSettingsDrawerSource,
  /CHAT_SETTINGS_SURFACES\[chatMode\]/u,
  "Chat Settings Drawer must select the active mode's settings surface directly",
);
for (const surfaceField of ["showSettingsProfiles", "promptSettingsSurface", "agentSettingsSurface"]) {
  assert.match(
    chatSettingsDrawerSource,
    new RegExp(`\\b${surfaceField}\\b`, "u"),
    `Chat Settings Drawer must consume the ${surfaceField} settings-surface policy`,
  );
}
assert.match(
  chatSettingsDrawerSource,
  /agentSettingsSurface\s*===\s*["']conversation["']\s*&&\s*\(\s*<ConversationAgentsSection\b/u,
  "Conversation Agents visibility must consume the conversation agent-settings surface",
);
assert.match(
  chatSettingsDrawerSource,
  /agentSettingsSurface\s*===\s*["']generation["']\s*&&\s*\(\s*<RoleplayAgentsSection\b/u,
  "Roleplay and Game Agents visibility must consume the generation agent-settings surface",
);
assert.match(
  roleplayAgentsSectionSource,
  /return \(\s*<Section\s+id=\{`\$\{chatMode\}-agents`\}/u,
  "the Roleplay and Game Agents component renders the mode's Agents section",
);
assert.doesNotMatch(
  chatSettingsDrawerSource,
  /getChatModeCapabilities|modeCapabilities/u,
  "Chat Settings Drawer must use the settings-surface policy instead of shared capabilities",
);
assert.doesNotMatch(
  chatSettingsDrawerSource,
  /supportsPromptPresets\s*&&\s*isRoleplayMode/u,
  "Prompt preset visibility must not contradict the matrix with a duplicate roleplay gate",
);
assert.doesNotMatch(
  chatSettingsDrawerSource,
  /sharedSections\s*\.includes\(\s*["']agents["']\s*\)\s*&&\s*!isConversation/u,
  "Agent settings visibility must not retain the obsolete sharedSections/isConversation gate",
);
const gameAssetHooksSource = readFileSync(
  new URL("../../packages/client/src/hooks/use-game-assets.ts", import.meta.url),
  "utf8",
);
const deviceDetailSource = readFileSync(
  new URL("../../packages/client/src/components/connections/DeviceDetail.tsx", import.meta.url),
  "utf8",
);
const notificationSettingsSource = readFileSync(
  new URL("../../packages/client/src/components/panels/settings/SettingControls.tsx", import.meta.url),
  "utf8",
).replace(/\r\n/gu, "\n");
const gameAssetsRoutesSource = readFileSync(
  new URL("../../packages/server/src/routes/game-assets.routes.ts", import.meta.url),
  "utf8",
);
assert.match(gameAssetsRoutesSource, /app\.get\("\/local-music-file"/u);
assert.match(gameAssetsRoutesSource, /const \{ path: encoded \} = \(req\.query as \{ path\?: string \}\)/u);
assert.doesNotMatch(gameAssetsRoutesSource, /app\.get\("\/local-music-file\/:encoded"/u);
assert.match(chatSettingsDrawerSource, /setFirstMesConfirm\(null\);[\s\S]*addSilentGreetingSwipes/u);
assert.equal(
  chatSettingsDrawerSource.match(/<GenerationSettingsLink/gu)?.length,
  3,
  "generation settings navigation should use one shared control in all three locations",
);
assert.match(gameAssetHooksSource, /invalidateQueries\(\{ queryKey: gameAssetKeys\.all \}\)/u);
assert.match(deviceDetailSource, /connections\.device\.whisper\.deleteFailed/u);
const browserNotificationHelpSource =
  notificationSettingsSource.match(/const browserNotificationHelp =[\s\S]*?;\n/u)?.[0] ?? "";
assert.match(browserNotificationHelpSource, /Browser notifications require HTTPS or localhost/u);
assert.match(browserNotificationHelpSource, /Browser notifications are not available in this environment/u);
assert.match(browserNotificationHelpSource, /Reset this site's notification permission/u);

const uiStoreSource = readFileSync(new URL("../../packages/client/src/stores/ui.store.ts", import.meta.url), "utf8");
const syncedSettingsSource = uiStoreSource.slice(
  uiStoreSource.indexOf("export function pickSyncedSettings"),
  uiStoreSource.indexOf("export const useUIStore"),
);
assert.match(
  syncedSettingsSource,
  /gameTextEffectsEnabled: state\.gameTextEffectsEnabled/,
  "Game text effects must remain off after synced settings are restored",
);

const summaryPopoverSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/client/src/components/chat/ChatSummaryPanel.tsx"),
  "utf8",
);
const promptSettingsPersistSource = summaryPopoverSource.slice(
  summaryPopoverSource.indexOf("const persistPromptTemplates"),
  summaryPopoverSource.indexOf("const commitCombinePromptDraft"),
);
const promptSettingsLockIndex = promptSettingsPersistSource.indexOf("promptSettingsSaveLockedRef.current = true");
const promptSettingsMutationIndex = promptSettingsPersistSource.indexOf("updateGlobalPromptSettings.mutateAsync");
const promptSettingsUnlockIndex = promptSettingsPersistSource.indexOf("promptSettingsSaveLockedRef.current = false");
assert.ok(
  promptSettingsLockIndex >= 0 &&
    promptSettingsLockIndex < promptSettingsMutationIndex &&
    promptSettingsMutationIndex < promptSettingsUnlockIndex,
  "Summary prompt writes must lock before mutation and unlock only afterward",
);
const summaryPromptControlsSource = summaryPopoverSource.slice(
  summaryPopoverSource.indexOf('role="tablist"'),
  summaryPopoverSource.indexOf('localizeUi("ui.chat.summarypopover.summaryConnection")'),
);
assert.equal(
  summaryPromptControlsSource.match(/disabled=\{promptSettingsSaveLocked\}/gu)?.length,
  8,
  "Every prompt option, template row, and open template editor control must use the save lock",
);
assert.equal(
  summaryPromptControlsSource.match(/disabled=\{!globalPromptSettingsReady \|\| promptSettingsSaveLocked\}/gu)?.length,
  2,
  "Every prompt-level action must use the save lock",
);
assert.match(
  summaryPromptControlsSource,
  /!hasTemplateDraft \|\|\s*promptSettingsSaveLocked \|\|\s*!globalPromptSettingsReady/u,
  "The template Save action must use the save lock",
);
const summaryPromptSelectOptionSource = summaryPopoverSource.slice(
  summaryPopoverSource.indexOf("interface SummaryPromptSelectOptionProps"),
  summaryPopoverSource.indexOf("interface SummaryPromptTemplateRowProps"),
);
assert.equal(
  summaryPromptSelectOptionSource.match(/disabled=\{disabled\}/gu)?.length,
  1,
  "Summary prompt select options must forward their disabled state",
);
const summaryPromptTemplateRowSource = summaryPopoverSource.slice(
  summaryPopoverSource.indexOf("interface SummaryPromptTemplateRowProps"),
);
assert.equal(
  summaryPromptTemplateRowSource.match(/disabled=\{disabled\}/gu)?.length,
  4,
  "Every template-row action must forward its disabled state",
);

// Issues #4114-#4119 and the Prose Guardian staging regression — keep the
// focused UI/cache ordering fixes from being lost in future refactors.
{
  // The Maps hosts are the Agents cards, so count across the drawer, its Agents state and the Roleplay/Game cards.
  const chatSettingsSource = [
    drawerAndAgentsStateSource,
    roleplayAgentsSectionSource,
    agentSettingsRenderersSource,
  ].join("\n");
  const memoryRecallSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/features/chat-settings/sections/MemoryRecallSection.tsx"),
    "utf8",
  );
  assert.match(
    memoryRecallSource,
    /<SettingsSwitch[\s\S]{0,220}checked=\{effectiveValue\}/u,
    "Memory Recall must expose its switch state to assistive technology",
  );
  assert.match(
    notificationSettingsSource,
    /export function SettingsSwitch[\s\S]*?<Switch[\s\S]{0,100}checked=\{checked\}/u,
    "The shared settings switch must render the shared Switch",
  );
  assert.match(
    chatSettingsSource,
    /const openLorebookFromSettings = useCallback\([\s\S]{0,220}closeForSurface\(\);[\s\S]{0,80}openLorebookDetail\(lorebookId\);/u,
    "Opening linked Maps lore from Chat Settings must close the drawer before navigating",
  );
  assert.equal(
    chatSettingsSource.match(/onOpenLorebook: openLorebookFromSettings/gu)?.length,
    2,
    "Every Chat Settings Maps host must use the close-and-open lorebook callback",
  );

  const generateHookSource = readFileSync(join(REPOSITORY_ROOT, "packages/client/src/hooks/use-generate.ts"), "utf8");
  const clearStreamIndex = generateHookSource.indexOf("clearStreamBuffer(params.chatId);");
  const exposeStreamingIndex = generateHookSource.indexOf("setStreaming(true, params.chatId);", clearStreamIndex);
  assert.ok(
    clearStreamIndex >= 0 && exposeStreamingIndex > clearStreamIndex,
    "A completed response must be cleared before the next streaming state is exposed",
  );

  const chatsHookSource = readFileSync(join(REPOSITORY_ROOT, "packages/client/src/hooks/use-chats.ts"), "utf8");
  assert.match(
    chatsHookSource,
    /recentMessageContentEdits[\s\S]+preserveRecentMessageContentEdit/u,
    "Recent user edits must survive authoritative generation refreshes",
  );
  assert.match(
    chatsHookSource,
    /cancelQueries\([\s\S]{0,180}revert:\s*false/u,
    "Saving a message edit must not revert the immediately painted cache value",
  );
  const roleplaySurfaceSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/chat/ChatRoleplaySurface.tsx"),
    "utf8",
  );
  assert.match(roleplaySurfaceSource, /key=\{msg\.id\}/u, "Roleplay message editors must keep a stable message key");

  const connectionEditorSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/connections/ConnectionEditor.tsx"),
    "utf8",
  );
  const saveDefaultsIndex = connectionEditorSource.indexOf("await saveConnectionDefaults.mutateAsync");
  const saveConnectionIndex = connectionEditorSource.indexOf("await updateConnection.mutateAsync", saveDefaultsIndex);
  assert.ok(
    saveDefaultsIndex >= 0 && saveConnectionIndex > saveDefaultsIndex,
    "Connection defaults must finish saving before the connection snapshot is persisted",
  );
  assert.match(
    connectionEditorSource,
    /remoteLoras = useMemo\(\(\) => modelList\.data\?\.loras \?\? \[\], \[modelList\.data\]\)/u,
    "Remote LoRA choices must come from the current model list, so a provider change cannot leave stale ones",
  );
  assert.match(
    connectionEditorSource,
    /src\.id === "zai"[\s\S]{0,180}!ZAI_IMAGE_MODELS\.some[\s\S]{0,180}setLocalModel\("glm-image"\)/u,
    "Switching to Z.AI must replace a model that Z.AI does not support",
  );
  assert.match(
    connectionEditorSource,
    /const swarmUiWorkflowError =\s*\(selectedImageService === "swarmui" \|\| selectedVideoProvider === "swarmui"\)[\s\S]{0,180}%reference_image_name/u,
    "SwarmUI workflow validation must reject backend-local reference-image filenames before save",
  );
  assert.match(connectionEditorSource, /if \(swarmUiWorkflowError\) \{[\s\S]{0,180}throw new Error/u);
  assert.match(
    connectionEditorSource,
    /type="button"[\s\S]{0,180}novelAiStylePlateInputRef\.current\?\.click\(\)[\s\S]{0,1000}type="file"/u,
    "NovelAI style-plate selection must use an explicit non-submitting button instead of label navigation",
  );
  assert.match(
    connectionEditorSource,
    /localImageDefaultsRef\.current = sanitized;[\s\S]{0,100}setLocalImageDefaults\(sanitized\)/u,
    "NovelAI defaults must update a synchronous save snapshot before React paints the next render",
  );
  assert.match(
    connectionEditorSource,
    /selectedImageDefaultsService && localImageDefaultsRef\.current[\s\S]{0,140}sanitizeImageGenerationProfile\(localImageDefaultsRef\.current/u,
    "Connection save must persist the latest image defaults snapshot",
  );

  const backgroundAutonomousSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/hooks/use-background-autonomous.ts"),
    "utf8",
  );
  const savedEventIndex = backgroundAutonomousSource.indexOf('eventType === "message_saved"');
  const cachePaintIndex = backgroundAutonomousSource.indexOf("upsertPersistedMessages(", savedEventIndex);
  const notificationIndex = backgroundAutonomousSource.indexOf("playConfiguredNotificationPing(", cachePaintIndex);
  assert.ok(
    savedEventIndex >= 0 && cachePaintIndex > savedEventIndex && notificationIndex > cachePaintIndex,
    "Background messages must be painted from message_saved before the notification fires",
  );
  assert.match(
    backgroundAutonomousSource,
    /typeof rewrite\.editedText === "string"[\s\S]{0,500}delete nextExtra\.postProcessingPending/u,
    "Background no-op rewrite events must paint the final text and clear the pending marker",
  );

  assert.equal(explicitlyRequestsTextRewrite(true), true);
  assert.equal(explicitlyRequestsTextRewrite(" TRUE "), true);
  assert.equal(explicitlyRequestsTextRewrite("false"), false);
  assert.equal(explicitlyRequestsTextRewrite(undefined), false);
}

// Issue #4120 — generated ElevenLabs game audio is opt-in; sound effects are
// requested as free text by scene analysis (music moved to context tracks,
// #5161) and every generation call is timeout-bounded.
{
  assert.match(
    gameSurfaceSource,
    /withTimeout\(\s*\(signal\) =>\s*api\.post<\{ tag: string; path: string \}>\(\s*"\/tts\/game-audio"[\s\S]{0,400}GAME_AUDIO_GENERATION_TIMEOUT_MS/u,
    "Generated game audio must not leave scene preparation waiting indefinitely",
  );

  const ttsDefaults = ttsConfigSchema.parse({});
  assert.equal(ttsDefaults.elevenLabsGameSoundEffects, false);
  assert.equal(ttsDefaults.elevenLabsGameMusic, false);
  const enabled = ttsConfigSchema.parse({
    source: "elevenlabs",
    elevenLabsGameSoundEffects: true,
    elevenLabsGameMusic: true,
  });
  assert.equal(enabled.elevenLabsGameSoundEffects, true);
  assert.equal(enabled.elevenLabsGameMusic, true);

  const generatedAudioContext = {
    currentState: "exploration" as const,
    turnNumber: 2,
    availableBackgrounds: ["backgrounds:fantasy:forest"],
    availableSfx: [],
    activeWidgets: [],
    trackedNpcs: [],
    characterNames: [],
    currentBackground: "backgrounds:fantasy:forest",
    currentMusic: null,
    currentWeather: null,
    currentTimeOfDay: null,
    generateSoundEffects: true,
    generateMusic: true,
  };
  const prompt = buildSceneAnalyzerUserPrompt("Boots cross the wet stones.", undefined, generatedAudioContext);
  assert.match(prompt, /short sound description/u);
  assert.match(prompt, /"sfxLoopCount": <1-5>/u);
  assert.doesNotMatch(prompt, /"(?:sfxLoopCount|directions|background)"[^\n]*\/\//u);
  // #5161: music free-text prompts are retired — even with generateMusic on,
  // the analyzer is asked for genre/intensity hints, never a music prompt.
  assert.doesNotMatch(prompt, /concise instrumental scene music prompt/u);
  assert.match(prompt, /musicGenre/u);
  assert.match(prompt, /musicIntensity/u);

  const processed = postProcessSceneResult(
    {
      background: null,
      music: " tense strings <then> a hopeful transition ",
      ambient: null,
      weather: null,
      timeOfDay: null,
      reputationChanges: [],
      segmentEffects: [
        { segment: 0, sfx: [" quiet footsteps <on> wet stone "], sfxLoopCount: 9, music: "low suspense pulse" },
      ],
    },
    {
      availableBackgrounds: generatedAudioContext.availableBackgrounds,
      availableSfx: [],
      generateSoundEffects: true,
      generateMusic: true,
      validWidgetIds: new Set(),
      characterNames: [],
    },
  );
  // #5161: free-text music never survives postprocess — scoring fills music
  // downstream from the library (context tracks included). SFX unchanged.
  assert.equal(processed.music, null);
  assert.deepEqual(processed.segmentEffects?.[0]?.sfx, ["quiet footsteps on wet stone"]);
  assert.equal(processed.segmentEffects?.[0]?.sfxLoopCount, 5);
  assert.equal(processed.segmentEffects?.[0]?.music, undefined);

  const lowerBoundProcessed = postProcessSceneResult(
    {
      ...processed,
      segmentEffects: [{ segment: 0, sfx: ["footsteps"], sfxLoopCount: 0 }],
    },
    {
      availableBackgrounds: generatedAudioContext.availableBackgrounds,
      availableSfx: [],
      generateSoundEffects: true,
      generateMusic: true,
      validWidgetIds: new Set(),
      characterNames: [],
    },
  );
  assert.equal(lowerBoundProcessed.segmentEffects?.[0]?.sfxLoopCount, 1);

  const spotifyProcessed = postProcessSceneResult(
    {
      ...processed,
      segmentEffects: [{ segment: 0, music: "generated music prompt" }],
    },
    {
      availableBackgrounds: generatedAudioContext.availableBackgrounds,
      availableSfx: [],
      generateSoundEffects: false,
      generateMusic: true,
      useSpotifyMusic: true,
      validWidgetIds: new Set(),
      characterNames: [],
    },
  );
  assert.equal(spotifyProcessed.music, null);
  assert.equal(spotifyProcessed.segmentEffects?.[0]?.music, undefined);
}

// Issues #4237-#4240 — keep the current issue-sweep fixes wired through the
// user-facing paths that originally skipped or constrained them.
{
  const conversationMessageSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/chat/ConversationMessage.tsx"),
    "utf8",
  );
  const conversationViewSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/chat/ConversationView.tsx"),
    "utf8",
  );
  assert.match(
    conversationMessageSource,
    /applyToAIOutput\(message\.content,[\s\S]{0,240}depth: messageDepth/u,
    "Conversation messages must apply display regex scripts with their transcript depth",
  );
  assert.match(
    conversationMessageSource,
    /applyToAIOutput\(part,[\s\S]{0,240}depth: messageDepth/u,
    "Conversation message parts must not bypass display regex scripts",
  );
  assert.match(
    conversationViewSource,
    /const messageDepth = Math\.max\(0, totalMessageCount - 1 - item\.index\);/u,
    "Conversation regex depth must be derived for every rendered transcript item",
  );
  assert.ok(
    (conversationViewSource.match(/messageDepth=\{messageDepth\}/gu)?.length ?? 0) >= 2,
    "Stored and regenerating Conversation messages must share their transcript depth",
  );
  assert.match(
    conversationViewSource,
    /liveStreamMessage[\s\S]{0,900}messageDepth=\{0\}/u,
    "A live Conversation stream must apply depth-scoped regex as the newest message",
  );

  const { normalizeVideoGenerationProfile } =
    await import("../../packages/shared/src/constants/video-generation-defaults.js");
  assert.equal(
    normalizeVideoGenerationProfile({
      service: "comfyui",
      comfyui: { durationSeconds: 6, aspectRatio: "16:9", resolution: "720p" },
    }).profile.comfyui.fps,
    16,
    "Legacy ComfyUI video profiles must retain the historical 16 FPS default",
  );
  assert.equal(
    normalizeVideoGenerationProfile({
      service: "comfyui",
      comfyui: { durationSeconds: 6, fps: 24, aspectRatio: "16:9", resolution: "720p" },
    }).profile.comfyui.fps,
    24,
    "ComfyUI video profiles must preserve a configured FPS",
  );
  const videoGenerationSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/server/src/services/video/video-generation.ts"),
    "utf8",
  );
  assert.match(
    videoGenerationSource,
    /comfyUiVideoFetch\(\s*`\$\{base\}\/history\/\$\{encodeURIComponent\(promptId\)\}`,[\s\S]{0,120}MAX_VIDEO_JSON_RESPONSE_BYTES/u,
    "Local ComfyUI video history must use the bounded large JSON response cap",
  );

  const connectionsRouteSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/server/src/routes/connections.routes.ts"),
    "utf8",
  );
  const testImageHandler = connectionsRouteSource.match(
    /app\.post<\{ Params: \{ id: string \} \}>\("\/:id\/test-image"[\s\S]*?\/\/ ── Test video generation/u,
  )?.[0];
  assert.ok(testImageHandler, "The connection test-image handler must remain available");
  assert.match(testImageHandler, /width: 1024,\s*height: 1024,/u);
  assert.match(testImageHandler, /debugMode: readDebugMode\(req\.body\)/u);
  assert.match(
    connectionsRouteSource,
    /signal: AbortSignal\.timeout\(SWARMUI_CONTROL_REQUEST_TIMEOUT_MS\)/u,
    "SwarmUI control requests must have a bounded timeout",
  );

  assert.doesNotMatch(
    agentEditorSource,
    /!isDirectorAgent && localInjectAsSection/u,
    "Narrative Director must be allowed to save and export Add as Prompt Section",
  );
  assert.ok(
    (agentEditorSource.match(/\.\.\.\(localInjectAsSection \? \{ injectAsSection: true \} : \{\}\)/gu)?.length ?? 0) >=
      2,
    "Agent save and export paths must preserve Add as Prompt Section",
  );
  const presetEditorSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/presets/PresetEditor.tsx"),
    "utf8",
  );
  assert.match(
    presetEditorSource,
    /injectableAgents\.map[\s\S]{0,700}justify-start[\s\S]{0,120}text-left/u,
    "Agent section choices must align with the preset editor's other add-section choices",
  );
}

// Issue #4277 — the Secret Plot interval remains editable after Narrative
// Director is installed instead of passing a string through a number-only
// normalizer and immediately restoring the previous value.
{
  assert.match(
    chatSettingsDrawerSource,
    /<DraftNumberInput\s+value=\{narrativeDirectorSecretPlotRunInterval\}\s+min=\{1\}\s+max=\{100\}\s+onCommit=\{\(value\) =>\s+updateMeta\.mutate\(\{\s+id: chat\.id,\s+narrativeDirectorSecretPlotRunInterval: value,/u,
    "Secret Plot run interval must use a draft number input that commits the edited numeric value",
  );
  assert.doesNotMatch(
    chatSettingsDrawerSource,
    /narrativeDirectorSecretPlotRunInterval:\s*normalizePositiveInteger\(\s*event\.target\.value/u,
    "Secret Plot run interval must not reject the browser's string input value",
  );
}

// Issue #4449 — desktop sidebar hover actions overlay row content instead of
// permanently reserving text width, while touch layouts keep room for visible
// actions and Conversation Call duration rows size from their panel width.
{
  const sidebarPanelSources = new Map(
    ["Characters", "Personas", "Lorebooks", "Agents", "Presets"].map((panelName) => [
      panelName,
      readFileSync(join(REPOSITORY_ROOT, `packages/client/src/components/panels/${panelName}Panel.tsx`), "utf8"),
    ]),
  );

  for (const [panelName, source] of sidebarPanelSources) {
    assert.match(
      source,
      /max-md:pr-(?:10|14|16|20|24|32|36|\[4\.5rem\]) \[@media\(pointer:coarse\)\]:pr-(?:10|14|16|20|24|32|36|\[4\.5rem\])/u,
      `${panelName} rows must reserve action space only for touch layouts`,
    );
    assert.doesNotMatch(
      source,
      /\[@media\(pointer:fine\)\]:group-hover:pr-/u,
      `${panelName} rows must not shrink their text area when desktop hover actions appear`,
    );
    assert.match(
      source,
      /pointer-events-none[^"\n]*group-hover(?:\/member)?:opacity-100[^"\n]*\[@media\(pointer:fine\)\]:group-focus-within(?:\/member)?:opacity-100[^"\n]*\[@media\(pointer:coarse\)\]:opacity-100[^"\n]*group-hover(?:\/member)?:\[&_button\]:pointer-events-auto[^"\n]*\[@media\(pointer:fine\)\]:group-focus-within(?:\/member)?:\[&_button\]:pointer-events-auto[^"\n]*max-md:\[&_button\]:pointer-events-auto[^"\n]*\[@media\(pointer:coarse\)\]:\[&_button\]:pointer-events-auto/u,
      `${panelName} action overlays must activate button hit targets only when their actions are visible`,
    );
    const hiddenActionOverlayCount = source.match(/pointer-events-none[^"\n]*opacity-0/gu)?.length ?? 0;
    const focusVisibleOverlayCount =
      source.match(/pointer-events-none[^"\n]*\[@media\(pointer:fine\)\]:group-focus-within(?:\/member)?:opacity-100/gu)
        ?.length ?? 0;
    const focusInteractiveOverlayCount =
      source.match(
        /pointer-events-none[^"\n]*\[@media\(pointer:fine\)\]:group-focus-within(?:\/member)?:(?:\[&_button\]:)?pointer-events-auto/gu,
      )?.length ?? 0;
    assert.equal(
      focusVisibleOverlayCount,
      hiddenActionOverlayCount,
      `${panelName} must reveal every fine-pointer action overlay while it contains keyboard focus`,
    );
    assert.equal(
      focusInteractiveOverlayCount,
      hiddenActionOverlayCount,
      `${panelName} must keep every focused fine-pointer action overlay interactive`,
    );
  }

  // Connection Model rows (variant D): the star and "…" stay visible, so nothing overlays the row, and touch
  // layouts get 44 px targets.
  const connectionRowSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/connections/ConnectionRow.tsx"),
    "utf8",
  );
  const modelRowSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/connections/ModelRow.tsx"),
    "utf8",
  );
  for (const source of [connectionRowSource, modelRowSource]) {
    assert.doesNotMatch(source, /opacity-0|group-hover:/u, "Connection rows must not hide actions behind hover");
  }
  // Row buttons use the shared chrome icon class, which grows to 44 px on phones and touch screens.
  assert.match(connectionRowSource, /ROW_BUTTON = "mari-chrome-control[^"]*mari-chrome-control--icon[^"]*"/u);
  const connectionStyles = readFileSync(join(REPOSITORY_ROOT, "packages/client/src/styles/globals.css"), "utf8");
  assert.match(
    connectionStyles,
    /@media \(max-width: 47\.9375rem\), \(pointer: coarse\) \{[^}]*\.mari-connection-scope \.mari-chrome-control[^}]*min-height: 2\.75rem/u,
  );
  assert.match(
    connectionStyles,
    /@media \(max-width: 47\.9375rem\), \(pointer: coarse\) \{[\s\S]*?\.mari-connection-scope \.mari-chrome-control--icon \{[^}]*width: 2\.75rem/u,
    "Connection icon buttons must retain a 44 px touch width",
  );

  const personasPanelSource = sidebarPanelSources.get("Personas")!;
  const charactersPanelSource = sidebarPanelSources.get("Characters")!;
  const presetsPanelSource = sidebarPanelSources.get("Presets")!;
  for (const panelName of ["Characters", "Personas", "Lorebooks", "Agents", "Presets"]) {
    assert.match(
      sidebarPanelSources.get(panelName)!,
      /group relative flex cursor-pointer[^"\n]*max-md:pr-12 \[@media\(pointer:coarse\)\]:pr-12/u,
      `${panelName} folder headers must reserve space for always-visible touch actions`,
    );
  }
  assert.match(
    charactersPanelSource,
    /pr-0 max-md:pr-32 \[@media\(pointer:coarse\)\]:pr-32/u,
    "Character rows must match their coarse-pointer padding to the desktop-width action toolbar",
  );
  assert.match(
    charactersPanelSource,
    /group-hover\/member:opacity-100[^"\n]*max-md:static max-md:translate-y-0[^"\n]*\[@media\(pointer:coarse\)\]:static \[@media\(pointer:coarse\)\]:translate-y-0/u,
    "Character folder-member actions must participate in touch layout instead of overflowing their row",
  );
  assert.match(
    presetsPanelSource,
    /max-md:pr-36 \[@media\(pointer:coarse\)\]:pr-36/u,
    "Preset rows must reserve space for the complete selected-preset touch toolbar",
  );
  assert.match(
    charactersPanelSource,
    /data-character-row-name\s+className="w-fit max-w-full truncate/u,
    "Character names must keep a content-sized click target beneath overlaid actions",
  );
  assert.match(
    personasPanelSource,
    /className="w-fit max-w-full truncate text-sm font-medium">\{persona\.name\}/u,
    "Persona names must keep a content-sized click target beneath overlaid actions",
  );
  assert.match(
    charactersPanelSource,
    /data-touch-drag-card="character"[\s\S]*?onKeyDown=\{\(e\) => \{\s*if \(e\.target !== e\.currentTarget\) return;/u,
    "Character folder rows must preserve descendant action-button keyboard events",
  );
  assert.match(
    personasPanelSource,
    /data-touch-drag-card="persona"[\s\S]*?onKeyDown=\{\(e\) => \{\s*if \(e\.target !== e\.currentTarget\) return;/u,
    "Persona folder rows must preserve descendant action-button keyboard events",
  );
  assert.match(
    personasPanelSource,
    /group group\/member relative flex/u,
    "Persona folder rows must establish the positioning context for overlaid actions",
  );
  assert.match(
    personasPanelSource,
    /absolute right-1 top-1\/2 flex -translate-y-1\/2 items-center/u,
    "Persona folder actions must overlay their row instead of occupying flex width",
  );

  const settingsPanelSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/panels/SettingsPanel.tsx"),
    "utf8",
  );
  assert.match(
    settingsPanelSource,
    /grid-cols-\[repeat\(auto-fit,minmax\(min\(100%,10rem\),1fr\)\)\]/u,
    "Conversation Call clip rows must wrap from the panel width instead of a viewport breakpoint",
  );
  assert.equal(
    settingsPanelSource.match(/w-\[3\.75rem\] grid-cols-\[minmax\(0,1fr\)_auto\]/gu)?.length,
    2,
    "Conversation Call generated and custom clip duration controls must share the compact width",
  );
  assert.match(
    settingsPanelSource,
    /id="quick-replies-actions-drawer"[\s\S]{0,180}grid min-w-0 max-w-full[\s\S]{0,80}overflow-hidden/u,
    "Quick reply actions must shrink within narrow settings panels",
  );
  assert.match(
    settingsPanelSource,
    /CustomQuickRepliesManager[\s\S]{0,900}mt-1 min-w-0 max-w-full overflow-hidden/u,
    "Custom quick replies must contain their fields and destructive controls at narrow widths",
  );
}

// Issues #4532 and #4533 — every runtime World Maps host must preserve the
// target chat mode, while Chat Settings uses feature copy instead of repeating
// package-installation guidance in an already-reached activation surface.
{
  const findCapabilityHosts = (source: string, packageId: string, view: string) =>
    (source.match(/<CapabilityElement\b[\s\S]*?\/>/gu) ?? []).filter(
      (host) => host.includes(`packageId="${packageId}"`) && host.includes(`view="${view}"`),
    );
  const sourceBetween = (source: string, startMarker: string, endMarker: string, label: string) => {
    const start = source.indexOf(startMarker);
    assert.ok(start >= 0, `${label} start marker must exist`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `${label} end marker must exist after its start marker`);
    return source.slice(start, end);
  };

  const chatInputSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/chat/ChatInput.tsx"),
    "utf8",
  );
  const roleplayRuntimeHosts = findCapabilityHosts(chatInputSource, "hierarchical-maps", "runtime");
  assert.equal(roleplayRuntimeHosts.length, 1, "Roleplay must expose exactly one World Maps runtime host");
  assert.match(
    roleplayRuntimeHosts[0],
    /capabilityProps=\{\{[\s\S]*?chatId: activeChatId,[\s\S]*?chatMode: mode,/u,
    "Roleplay World Maps runtime controls must preserve the active chat mode",
  );

  const gameInputSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/game/GameInput.tsx"),
    "utf8",
  );
  const gameRuntimeHosts = findCapabilityHosts(gameInputSource, "hierarchical-maps", "runtime");
  assert.equal(gameRuntimeHosts.length, 1, "Game input must expose exactly one World Maps runtime host");
  assert.match(
    gameRuntimeHosts[0],
    /capabilityProps=\{\{[\s\S]*?chatId: draftKey,[\s\S]*?chatMode: "game",/u,
    "Game World Maps runtime controls must identify their supported chat mode",
  );

  const gameMapSource = readFileSync(join(REPOSITORY_ROOT, "packages/client/src/components/game/GameMap.tsx"), "utf8");
  const gameWorldMapHosts = findCapabilityHosts(gameMapSource, "hierarchical-maps", "world-map");
  assert.equal(gameWorldMapHosts.length, 2, "Game Map must expose exactly its desktop and mobile World Maps hosts");
  const desktopWorldMapHosts = gameWorldMapHosts.filter((host) => !host.includes("compact: true,"));
  const mobileWorldMapHosts = gameWorldMapHosts.filter((host) => host.includes("compact: true,"));
  assert.equal(desktopWorldMapHosts.length, 1, "Desktop Game Map must expose one non-compact World Maps host");
  assert.equal(mobileWorldMapHosts.length, 1, "Mobile Game Map must expose one compact World Maps host");
  for (const [surface, host] of [
    ["Desktop", desktopWorldMapHosts[0]],
    ["Mobile", mobileWorldMapHosts[0]],
  ] as const) {
    assert.match(
      host,
      /capabilityProps=\{\{[\s\S]*?chatId,[\s\S]*?chatMode: "game",/u,
      `${surface} Game World Maps host must identify its supported chat mode`,
    );
  }

  const chatSettingsSource = drawerAndAgentsStateSource;
  assert.match(
    chatSettingsSource,
    /const worldMapsSettingsDescription = localizeUi\("ui\.chat\.chatsettingsdrawer\.worldMapsFeatureSummary"\);/u,
    "Chat Settings must source the World Maps feature summary from localization",
  );
  const worldMapsFeatureSummary = String(lorebookEnglishLocale["ui.chat.chatsettingsdrawer.worldMapsFeatureSummary"]);
  assert.equal(
    worldMapsFeatureSummary,
    "Adds world maps to Roleplay and Game, from whole regions down to single rooms, with art and travel between places.",
    "The canonical English World Maps settings summary must describe the feature",
  );
  assert.doesNotMatch(
    worldMapsFeatureSummary,
    /Add the Agent|Chat Settings|Tracker Agents/iu,
    "The World Maps settings summary must not repeat installation guidance",
  );
  const standaloneRoleplayAgentSettings = sourceBetween(
    agentSettingsRenderersSource,
    "const renderStandaloneRoleplayAgentSettingsCard =",
    "const renderAgentPromptTemplateSelect =",
    "Standalone Roleplay agent settings renderer",
  );
  assert.match(
    standaloneRoleplayAgentSettings,
    /agent\.id === "hierarchical-maps"[\s\S]*?<CapabilityElement[\s\S]*?<AgentSettingsCard[\s\S]*?agent\.id === "hierarchical-maps"[\s\S]*?worldMapsSettingsDescription/u,
    "Standalone Roleplay World Maps settings must use the concise feature summary",
  );
  const roleplayActiveAgentCards = sourceBetween(
    roleplayAgentsSectionSource,
    "{/* Active agents in this category */}",
    "{inactiveInCat.length > 0 ? (",
    "Roleplay active-agent settings cards",
  );
  assert.match(
    roleplayActiveAgentCards,
    /agent\.id === "hierarchical-maps"[\s\S]{0,120}\? worldMapsSettingsDescription[\s\S]{0,80}: agent\.description/u,
    "Roleplay Chat Settings must omit package-installation guidance from the active World Maps card",
  );
}

{
  // #4721: the chat transcript's infinite query keys ONLY by chat id — its
  // pageSize lives in the option closures, so ANY second observer with a
  // different pageSize hijacks the transcript's queryFn/getNextPageParam
  // (last observer wins in React Query). The Chat Settings drawer's
  // secret-plot reader did exactly that with a hardcoded 100: while the
  // drawer was open, transcript refetches ignored the user's
  // messages-per-page and "Load More" vanished on a mis-evaluated
  // hasNextPage. Read-only newest-N windows must go through the peek hook,
  // which keys by limit.
  const drawerSource = chatSettingsDrawerSource;
  assert.doesNotMatch(
    drawerSource,
    /useChatMessages\(/u,
    "Chat Settings must not observe the shared chatKeys.messages infinite query (#4721)",
  );
  assert.match(
    drawerSource,
    /useChatMessagePeek\(\s*chat\.id,\s*100,/u,
    "The secret-plot reader must fetch its newest-100 window through the limit-keyed peek hook",
  );
  const imageSettingUpdateSource =
    /const updateCustomAgentImageSetting = useCallback\([\s\S]*?\n  const updateCustomAgentImageConnection/u.exec(
      drawerSource,
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
    /const toggleAgent = async[\s\S]*?\n  const removeAgentFromMenu/u.exec(drawerSource)?.[0] ?? "";
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
  const removalWrite = serializedWrites.enqueue(async () => {
    writeOrder.push("removal");
  });
  const removingAgentIds = new Set(["image-agent"]);
  const blockedSelectorWrite = removingAgentIds.has("image-agent")
    ? null
    : serializedWrites.enqueue(async () => {
        writeOrder.push("stale-selector-write");
      });
  assert.equal(blockedSelectorWrite, null, "A selector event during removal must not enqueue a stale map");
  await Promise.resolve();
  assert.deepEqual(writeOrder, ["first:start"], "A delayed older metadata write must hold newer writes in order");
  releaseFirstWrite();
  await Promise.all([firstWrite, removalWrite, serializedWrites.waitForIdle()]);
  assert.deepEqual(writeOrder, ["first:start", "first:end", "removal"]);
  const trackerModelSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/features/tracker-panel/hooks/use-tracker-panel-model.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    trackerModelSource,
    /useChatMessages\(/u,
    "The tracker panel must not observe the shared chatKeys.messages infinite query (#4724)",
  );
  assert.match(
    trackerModelSource,
    /useChatMessagePeek\(\s*activeChatId,\s*20,/u,
    "The tracker panel must fetch its newest-20 sprite window through the limit-keyed peek hook",
  );
  const useChatsSource = readFileSync(join(REPOSITORY_ROOT, "packages/client/src/hooks/use-chats.ts"), "utf8");
  assert.match(
    useChatsSource,
    /queryKey: \[\.\.\.chatKeys\.messagePeek\(chatId \?\? ""\), limit\]/u,
    "The peek hook's query key must include its limit so different windows never share options",
  );
}

{
  // #4940, #4941, #4942 and the requested UI consistency fixes are thin
  // integration lanes, so pin their host wiring alongside the behavior checks.
  const chatAreaSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/chat/ChatArea.tsx"),
    "utf8",
  );
  const conversationSurfaceSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/chat/ChatConversationSurface.tsx"),
    "utf8",
  );
  const settingsDrawerSource = drawerAndAgentsStateSource;
  const gameMapSource = readFileSync(join(REPOSITORY_ROOT, "packages/client/src/components/game/GameMap.tsx"), "utf8");
  const generateRouteSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/server/src/routes/generate.routes.ts"),
    "utf8",
  );
  const turnGameBotRunnerSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/server/src/services/turn-games/turn-game-bot-runner.service.ts"),
    "utf8",
  );
  const turnGameCommandRuntimeSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/server/src/services/generation/turn-game-command-runtime.ts"),
    "utf8",
  );

  assert.match(
    chatAreaSource,
    /const handleIllustrateWithAgent = useCallback\([\s\S]*?forceImageGeneration: true[\s\S]*?<ChatConversationSurface[\s\S]*?onIllustrateWithAgent=\{handleIllustrateWithAgent\}/u,
    "Conversation Gallery must forward custom image-agent illustration requests",
  );
  // The Gallery drawer in Chat Settings reads the actions the conversation surface provides.
  assert.match(
    conversationSurfaceSource,
    /onIllustrateWithAgent,[\s\S]*?useProvideChatGalleryActions\(activeChatId, galleryActions\)/u,
  );

  assert.match(settingsDrawerSource, /useGenerationStatus\(\s*chat\.id,\s*open && isRoleplayMode/u);
  const generationStatusHookSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/hooks/use-chats.ts"),
    "utf8",
  );
  assert.match(generationStatusHookSource, /\/generate\/status\/\$\{encodeURIComponent\(chatId \?\? ""\)\}/u);
  assert.match(roleplayAgentsSectionSource, /isRoleplayMode && \(activeGeneration \|\| stoppingGeneration\)/u);
  assert.match(settingsDrawerSource, /await abortGenerationForChat\(chat\.id, controller\)/u);
  const stopGenerationActionStart = roleplayAgentsSectionSource.indexOf(
    "{isRoleplayMode && (activeGeneration || stoppingGeneration) && (",
  );
  const agentSuiteActionStart = roleplayAgentsSectionSource.indexOf(
    "onClick={() => setShowAgentSuiteModal(true)}",
    stopGenerationActionStart,
  );
  assert.ok(stopGenerationActionStart >= 0 && agentSuiteActionStart > stopGenerationActionStart);
  const stopGenerationActionSource = roleplayAgentsSectionSource.slice(
    stopGenerationActionStart,
    agentSuiteActionStart,
  );
  assert.match(stopGenerationActionSource, /bg-\[var\(--secondary\)\][\s\S]*hover:bg-\[var\(--accent\)\]/u);
  assert.match(stopGenerationActionSource, /text-\[var\(--muted-foreground\)\]/u);
  assert.doesNotMatch(stopGenerationActionSource, /red-/u);
  // Conversation's card is in agents/, so count across the drawer and its folders.
  assert.equal(
    (chatSettingsDrawerSource.match(/<LongTermMemoryCapabilitySettings\s[\s\S]*?packageId=\{ltmPackage\.id\}/gu) ?? [])
      .length,
    3,
    "Long-Term Memory must use the same un-nested Agent Settings surface in every chat mode",
  );
  assert.match(
    readFileSync(
      join(REPOSITORY_ROOT, "packages/client/src/features/chat-settings/agents/LongTermMemorySettings.tsx"),
      "utf8",
    ),
    /className = "block overflow-hidden rounded-lg"[\s\S]*?className=\{className\}/u,
    "the shared Long-Term Memory surface must stay un-nested",
  );

  assert.match(
    gameMapSource,
    /GAME_MAP_ACTION_ITEM_CLASS\s*=\s*\n\s*"text-\[var\(--primary\)\]/u,
    "Minimap zoom controls must inherit the selected accent color",
  );
  const turnGameResumeBlock =
    /\/\/ A normal chat send can claim[\s\S]*?\/\/ Signal completion before the slow illustration tail/u.exec(
      generateRouteSource,
    )?.[0] ?? "";
  assert.match(turnGameResumeBlock, /chatMode === "conversation"/u);
  assert.match(turnGameResumeBlock, /await runTurnGameBotTurns\(/u);
  assert.match(
    turnGameResumeBlock,
    /if \(generationSignal\.aborted \|\| isAbortLikeError\(turnGameErr\)\) return;/u,
    "Turn-game recovery must propagate cancellation without logging it as a failure",
  );
  assert.match(
    turnGameResumeBlock,
    /await runTurnGameBotTurns\([\s\S]*?if \(generationSignal\.aborted\) return;/u,
    "Turn-game recovery must re-check cancellation after a bot runner resolves",
  );
  assert.match(turnGameResumeBlock, /logger\.warn\(turnGameErr/u);
  assert.match(
    generateRouteSource,
    /logDebugOverride\(requestDebug \|\| isDebugAgentsEnabled\(\), message, \.\.\.args\)/u,
    "Turn-game prompt logging must honor both UI debug mode and DEBUG_AGENTS",
  );
  assert.equal(
    (generateRouteSource.match(/debugLog: turnGameDebugLog/gu) ?? []).length,
    3,
    "Every production turn-game runner path must receive the request-aware debug logger",
  );
  assert.match(turnGameCommandRuntimeSource, /debugLog: args\.debugLog/u);
  assert.match(
    turnGameBotRunnerSource,
    /args\.debugLog\?\.\([\s\S]*?debugJson\(moveMessages\)[\s\S]*?provider\.chatComplete\(moveMessages/u,
    "Turn-game bot moves must log the final provider prompt immediately before submission",
  );
}

{
  // #5142, #5147, #5155, #5158, #5160, and #5164: pin the thin integration
  // seams that connect the focused behavior fixes to their production hosts.
  const presetEditorSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/presets/PresetEditor.tsx"),
    "utf8",
  );
  assert.doesNotMatch(
    presetEditorSource,
    /useEffect\([\s\S]{0,500}duplicatePreset\.mutateAsync/u,
    "Opening a stock preset must never create an editable copy as a mount side effect",
  );
  assert.match(presetEditorSource, /ui\.presets\.preseteditor\.createEditableCopy/u);

  const imageGenerationSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/server/src/services/image/image-generation.ts"),
    "utf8",
  );
  assert.equal(
    (imageGenerationSource.match(/detectedMime \? imageExtensionFromMimeType\(detectedMime\) : null/gu) ?? []).length,
    2,
    "Saved and staged gallery images must derive their extension from their decoded bytes",
  );

  const generateRouteSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/server/src/routes/generate.routes.ts"),
    "utf8",
  );
  const retryAgentsRouteSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/server/src/routes/generate/retry-agents-route.ts"),
    "utf8",
  );
  const lorebookKeeperUtilsSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/server/src/routes/generate/lorebook-keeper-utils.ts"),
    "utf8",
  );
  assert.match(
    generateRouteSource,
    /chatMode === "roleplay" && assistantMessageReadySent\) \{[\s\S]{0,220}moveToActiveAgentRuns\([\s\S]{0,180}lastSavedSwipeIndex/u,
    "A durable Roleplay reply must release the main generation slot while retaining its cancellable agent tail",
  );
  assert.match(generateRouteSource, /const activeAgentRuns = new Map<string, Set<ActiveGeneration>>\(\)/u);
  assert.match(
    generateRouteSource,
    /registerRetryAgentsRoute\(app, activeCustomLorebookReadBehindRuns, activeAgentRuns\)/u,
    "Forced Agent retries must join the same cancellable registry as automatic Agent tails",
  );
  assert.match(
    generateRouteSource,
    /active: activeGenerations\.has\(req\.params\.chatId\) \|\| \(activeAgentRuns\.get\(req\.params\.chatId\)\?\.size \?\? 0\) > 0/u,
    "Generation status must preserve detached Agent activity across reconnects",
  );
  assert.match(
    generateRouteSource,
    /if \(body\.agentsOnly !== true && activeGeneration\?\.backendUrl\) \{[\s\S]{0,500}\/api\/extra\/abort/u,
    "Stopping an old agent tail must not send a backend-wide abort that can kill a newer reply",
  );
  assert.doesNotMatch(generateRouteSource, /targets\.map\(\(target\) => target\.backendUrl\)/u);
  assert.match(
    retryAgentsRouteSource,
    /for \(const result of results\) \{\s*if \(abortController\.signal\.aborted\) return;[\s\S]{0,500}sendSseEvent\(reply, \{\s*type: "agent_result"/u,
    "Forced retries must stop emitting results as soon as their shared abort signal fires",
  );
  assert.match(
    retryAgentsRouteSource,
    /if \(abortController\.signal\.aborted\) return;\s*await persistRetryResults\(/u,
    "Forced retries must check cancellation immediately before persistRetryResults",
  );
  assert.match(
    retryAgentsRouteSource,
    /if \(abortController\.signal\.aborted\) return;[\s\S]{0,140}await applyRetryResultEffects\(\{/u,
    "Forced retries must check cancellation before applyRetryResultEffects",
  );
  assert.match(
    retryAgentsRouteSource,
    /if \(abortController\.signal\.aborted\) return;\s*sendSseEvent\(reply, \{ type: "done"/u,
    "A cancelled retry must not emit its completion event",
  );
  assert.match(
    retryAgentsRouteSource,
    /assertRetrySetupActive\(\);\s*sendSseEvent\(reply, \{ type: "agent_start"/u,
    "A cancelled retry must not emit agent_start after asynchronous setup",
  );
  assert.match(
    retryAgentsRouteSource,
    /signal\.throwIfAborted\(\);\s*return \{[\s\S]{0,220}macroVariables/u,
    "Retry macro persistence must re-check cancellation when its queued write begins",
  );
  assert.match(
    retryAgentsRouteSource,
    /const assertRetryActive = \(\) => signal\.throwIfAborted\(\);[\s\S]{0,300}const sortedResults/u,
    "Retry side effects must use the native abort guard across awaited writes and events",
  );
  assert.match(
    retryAgentsRouteSource,
    /const rawResult = await executeAgent\([\s\S]{0,350}if \(baseContext\.signal\?\.aborted\) return results;/u,
    "Lorebook retries must stop after provider completion",
  );
  assert.match(
    retryAgentsRouteSource,
    /preferredTargetLorebookId = await persistLorebookKeeperUpdates\([\s\S]{0,700}signal: baseContext\.signal/u,
    "Lorebook retry persistence must receive the shared cancellation signal",
  );
  assert.match(
    lorebookKeeperUtilsSource,
    /signal\?: AbortSignal/u,
    "Lorebook Keeper persistence must accept a cancellation signal",
  );
  assert.match(
    lorebookKeeperUtilsSource,
    /signal\?\.throwIfAborted\(\);\s*const (?:created|updated) = await lorebooksStore\.(?:create|updateEntry|createEntry)/u,
    "Lorebook persistence must honor retry cancellation before database writes",
  );
  assert.match(
    retryAgentsRouteSource,
    /const customWritableLorebookIds =\s*!isBuiltInLorebookAgent && resultAgent[\s\S]{0,220}resolveCustomWritableLorebookIds\(resultAgent\.settings\)[\s\S]{0,900}writableLorebooks/u,
    "Custom-agent retry approvals must carry that agent's writable lorebook routing metadata",
  );
  assert.equal(
    retryAgentsRouteSource.match(
      /worldName: (?:retryContext|agentContext)\.characters\[0\]\?\.world \?\? (?:chatName|\(chat as any\)\.name)/gu,
    )?.length,
    3,
    "Retry approval and persistence must expand [WorldName] from the persisted character world, then the chat name",
  );
  assert.equal(
    generateRouteSource.match(/worldName: agentContext\.characters\[0\]\?\.world \?\? chat\.name/gu)?.length,
    2,
    "Normal approval and persistence must expand [WorldName] from the persisted character world, then the chat name",
  );
  const characterPromptContextSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/server/src/services/generation/character-prompt-context.ts"),
    "utf8",
  );
  assert.match(characterPromptContextSource, /world: cardPromptText\(charData\.extensions\?\.world\) \|\| undefined/u);
  assert.match(retryAgentsRouteSource, /world: cardPromptText\(extensions\.world\) \|\| undefined/u);
  const roleplayActionsSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/chat/RoleplayHUDActionsMenu.tsx"),
    "utf8",
  );
  assert.match(roleplayActionsSource, /showStopAgentsAction = isAgentProcessing && !!onStopAgents/u);
  assert.match(roleplayActionsSource, /ui\.chat\.roleplayhudactionsmenu\.stopAgents/u);
  assert.doesNotMatch(
    roleplayActionsSource,
    /stopAgents[\s\S]{0,700}text-\[var\(--destructive\)\]/u,
    "Stop Agents should use the same neutral action styling as its neighboring controls",
  );
  const appSource = readFileSync(join(REPOSITORY_ROOT, "packages/client/src/App.tsx"), "utf8");
  assert.doesNotMatch(
    appSource,
    /const paused = !\([\s\S]{0,220}!reduceAmbientEffects/u,
    "Reduced ambient motion must not pause Desktop Mari's functional navigation callbacks",
  );
  assert.match(
    generateRouteSource,
    /const targetSwipeIndex =[\s\S]{0,300}lastSavedMsg[\s\S]{0,300}activeSwipeIndex/u,
    "Post-processing agents must remain anchored to the swipe saved by their own generation",
  );
  assert.doesNotMatch(
    generateRouteSource,
    /refreshedForSwipe = await chats\.getMessage/u,
    "An old agent run must not retarget itself from a newly active swipe",
  );

  const generateHookSource = readFileSync(join(REPOSITORY_ROOT, "packages/client/src/hooks/use-generate.ts"), "utf8");
  const agentStoreSource = readFileSync(join(REPOSITORY_ROOT, "packages/client/src/stores/agent.store.ts"), "utf8");
  assert.match(
    generateHookSource,
    /case "assistant_message_ready":[\s\S]{0,1600}setAbortController\(params\.chatId, null\)/u,
  );
  assert.match(generateHookSource, /setProcessingRun\(agentProcessingRunId, false, params\.chatId\)/u);
  assert.match(agentStoreSource, /processingRunIdsByChat/u);

  assert.deepEqual(normalizeChatMacroVariables({ score: "8", invalid: 4, "bad name": "x" }), { score: "8" });
  const macroVariables = normalizeChatMacroVariables({ counter: "2" });
  assert.deepEqual(normalizeChatMacroVariables({ ...macroVariables, counter: "3" }), { counter: "3" });
  assert.equal(
    Object.keys(normalizeChatMacroVariables(Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`v${i}`, "x"]))))
      .length,
    500,
    "persisted chat-local macro variables remain capped",
  );
  const fullMacroVariables = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`v${i}`, "x"]));
  assert.deepEqual(
    mergeGeneratedChatMacroVariables(fullMacroVariables, fullMacroVariables, {
      ...fullMacroVariables,
      overflow: "generated",
    }),
    fullMacroVariables,
    "generation writes reapply the macro-variable cap after merging request changes",
  );
  assert.match(
    generateRouteSource,
    /macroVariables: mergeGeneratedChatMacroVariables\(\s*current\.macroVariables,\s*persistedMacroVariableSnapshot,\s*chatMacroVariables,/u,
    "generation persists macro variables through the bounded merge helper",
  );

  const perfDiagnosticsSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/lib/perf-diagnostics.ts"),
    "utf8",
  );
  assert.match(perfDiagnosticsSource, /PerformanceObserver\.supportedEntryTypes\?\.includes\("longtask"\)/u);

  const backupRoutesSource = readFileSync(join(REPOSITORY_ROOT, "packages/server/src/routes/backup.routes.ts"), "utf8");
  const settingsPanelSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/components/panels/SettingsPanel.tsx"),
    "utf8",
  );
  assert.match(backupRoutesSource, /app\.post\("\/download\/start"/u);
  assert.match(backupRoutesSource, /app\.get<\{ Params: \{ jobId: string \} \}>\(\s*"\/download\/status\/:jobId"/u);
  assert.match(
    backupRoutesSource,
    /app\.get<\{ Params: \{ jobId: string \}; Querystring: \{ token\?: string \} \}>\(\s*"\/download\/file\/:jobId"/u,
  );
  assert.match(
    backupRoutesSource,
    /if \(job\?\.status === "preparing"\) return;/u,
    "backup cleanup cannot remove a temporary directory while its archive is still being written",
  );
  assert.match(settingsPanelSource, /\/backup\/download\/status\/\$\{encodeURIComponent\(started\.jobId\)\}/u);
  assert.match(settingsPanelSource, /window\.location\.assign\(status\.downloadUrl\)/u);

  assert.match(
    retryAgentsRouteSource,
    /persistRetryMacroVariables\([\s\S]{0,240}agentContextResult\.macroVariables/u,
    "retry-agent prompt macro writes are persisted back to chat metadata",
  );
  assert.match(
    retryAgentsRouteSource,
    /for \(const entry of lorebookKeeperRunEntries\)[\s\S]{0,900}messageId: entry\.messageId,[\s\S]{0,80}swipeIndex: entry\.swipeIndex/u,
    "Lorebook Keeper backfill results retain each target message and swipe anchor",
  );
}

// #8933: a member's name in Chat Settings opens their full card again (Characters and Game Mode party), only after
// the drawer's guarded close (drafts and the inline card editor's saves finished; a pinned drawer stays open).
{
  // The two buttons live in the Characters and Game party sections, which chatSettingsDrawerSource includes.
  const cardOpens = chatSettingsDrawerSource.match(
    /void requestClose\(false\)\.then\(\(closed\) => \{\s*if \(closed\) \{\s*rememberSettingsReturn\(\);\s*useUIStore\.getState\(\)\.openCharacterDetail\(c\.id, \{ initialTab: "card" \}\);/gu,
  );
  assert.equal(cardOpens?.length, 2, "both member-name buttons open the card after a guarded, unforced close");
  assert.match(
    chatSettingsDrawerSource,
    /if \(!\(await flushProseGuardianDrafts\(\)\)\) return false;\s*if \(!\(await \(inlineCardFlushRef\.current\?\.\(\) \?\? Promise\.resolve\(true\)\)\)\) return false;[\s\S]{0,80}onClose\(\{ force \}\);/u,
    "the drawer's close waits for the inline card editor's saves",
  );
  assert.match(chatSettingsDrawerSource, /onFlushChange=\{handleInlineCardFlushChange\}/u);
  const inlineEditorSource = readFileSync(
    join(REPOSITORY_ROOT, "packages/client/src/features/chat-settings/inline-editors/InlineChatCardEditor.tsx"),
    "utf8",
  );
  assert.match(
    inlineEditorSource,
    /onFlushChange\(async \(\) => \{[\s\S]{0,400}commitField\(field\);\s*await saveQueueRef\.current;\s*return !lastSaveFailedRef\.current;/u,
    "the inline card editor hands the drawer a flush that waits for its queued saves",
  );
  assert.match(
    inlineEditorSource,
    /onFlushChange\(async \(\) => \{[\s\S]{0,160}lastSaveFailedRef\.current = false;/u,
    "a flush starts with no failure recorded",
  );
  assert.equal(
    inlineEditorSource.match(/lastSaveFailedRef\.current = false;/gu)?.length,
    1,
    "a later successful save never clears a failure within the flush",
  );
}

console.info("Open-issue regressions passed.");
