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

const characterRoutesSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/server/src/routes/characters.routes.ts"),
  "utf8",
);
const stCharacterImporterSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/server/src/services/import/st-character.importer.ts"),
  "utf8",
);
const marinaraImporterSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/server/src/services/import/marinara.importer.ts"),
  "utf8",
);
const importRoutesSource = readFileSync(join(REPOSITORY_ROOT, "packages/server/src/routes/import.routes.ts"), "utf8");
assert.match(
  characterRoutesSource,
  /const sprites = await readSpritesForId\(char\.id, true\);[\s\S]*if \(!sprites\)[\s\S]*status\(413\)[\s\S]*buildCompatibleCharacterExport\(charData, sprites, \{\s*keepOnboarding: true,/u,
  "PNG export must reject sprite collections that cannot round-trip before building the card envelope",
);
assert.match(
  characterRoutesSource,
  /if \(enforcePortableLimits\)[\s\S]*await stat[\s\S]*embeddedSpriteSizesAreWithinLimits[\s\S]*return null;[\s\S]*readImageAsDataUrl/u,
  "compatible PNG export must stop reading sprites as soon as a portable size limit is exceeded",
);
assert.match(
  stCharacterImporterSource,
  /await restoreSprites\(embeddedMarinaraSprites, charId, embeddedSpriteCatalog\)/u,
  "PNG import must restore embedded sprites under the newly imported character ID",
);
const nativeGalleryRestoreMatch = marinaraImporterSource.match(
  /export async function restoreSprites[\s\S]*?export async function importMarinara/u,
);
assert.ok(nativeGalleryRestoreMatch, "native gallery restore implementation must remain discoverable");
assert.doesNotMatch(
  nativeGalleryRestoreMatch[0],
  /MAX_FILE_SIZES|embeddedSpriteSizesAreWithinLimits|MAX_EMBEDDED_SPRITE_DATA_CHARS/u,
  "native character and persona imports must not reject galleries by byte size",
);
assert.doesNotMatch(
  stCharacterImporterSource,
  /MAX_CHARX_ENTRIES|MAX_CHARX_ENTRY_BYTES|MAX_CHARX_TOTAL_BYTES/u,
  "CharX imports must not reject galleries by entry count or byte size",
);
assert.match(
  importRoutesSource,
  /app\.post\("\/marinara-package", \{ bodyLimit: NATIVE_PACKAGE_UPLOAD_LIMIT_BYTES \}[\s\S]*?req\.file\(\{[\s\S]*?fields: 1,[\s\S]*?parts: 2,[\s\S]*?files: 1,[\s\S]*?fileSize: NATIVE_PACKAGE_UPLOAD_LIMIT_BYTES[\s\S]*?\}\)/u,
  "native character and persona packages must enforce the native package upload ceiling",
);
assert.match(
  importRoutesSource,
  /app\.post\("\/st-character", \{ bodyLimit: IMPORT_BODY_LIMIT_BYTES \}[\s\S]*?req\.file\(\{[\s\S]*?fields: 8,[\s\S]*?parts: 9,[\s\S]*?files: 1,[\s\S]*?fileSize: IMPORT_BODY_LIMIT_BYTES[\s\S]*?\}\)/u,
  "character-card uploads must enforce the upload-size ceiling",
);
assert.match(
  importRoutesSource,
  /req\.file\(\{[\s\S]*?fields: 8,[\s\S]*?parts: 9,[\s\S]*?files: 1,[\s\S]*?fieldSize: 64 \* 1024,[\s\S]*?fileSize: IMPORT_BODY_LIMIT_BYTES[\s\S]*?\}\)/u,
  "single character imports must bound the complete multipart request",
);
assert.match(
  importRoutesSource,
  /app\.post\("\/st-character\/inspect"[\s\S]*?req\.parts\(\{[\s\S]*?files: MAX_BATCH_IMPORT_FILES,[\s\S]*?parts: MAX_BATCH_IMPORT_FILES \+ 8,[\s\S]*?fileSize: IMPORT_BODY_LIMIT_BYTES[\s\S]*?\}\)[\s\S]*?totalBytes > IMPORT_BODY_LIMIT_BYTES[\s\S]*?status\(413\)\.send\(\{[\s\S]*?Import exceeds the total upload limit/u,
  "multi-file character imports must stop when their aggregate buffer exceeds the upload limit",
);
assert.match(
  importRoutesSource,
  /app\.post\("\/marinara-package"[\s\S]*?for \(const entry of entries\)[\s\S]*?NATIVE_PACKAGE_ENTRY_LIMIT_BYTES[\s\S]*?totalUncompressedBytes > NATIVE_PACKAGE_UPLOAD_LIMIT_BYTES[\s\S]*?package contents are too large[\s\S]*?dataEntry\.read\(NATIVE_PACKAGE_ENTRY_LIMIT_BYTES\)/u,
  "native package imports must validate ZIP entry sizes before extraction",
);
assert.match(
  importRoutesSource,
  /app\.post\("\/st-character\/batch"[\s\S]*?req\.parts\(\{[\s\S]*?files: MAX_BATCH_IMPORT_FILES,[\s\S]*?parts: MAX_BATCH_IMPORT_FILES \+ 8,[\s\S]*?fileSize: IMPORT_BODY_LIMIT_BYTES[\s\S]*?\}\)[\s\S]*?totalBytes > IMPORT_BODY_LIMIT_BYTES[\s\S]*?status\(413\)\.send\(\{[\s\S]*?Import exceeds the total upload limit/u,
  "multi-file character imports must stop when their aggregate buffer exceeds the upload limit",
);
assert.doesNotMatch(
  importRoutesSource,
  /MAX_DATA_JSON_BYTES|MAX_AVATAR_BYTES|MAX_CHARACTER_CARD_CHUNK_SIZE/u,
  "native packages must not use obsolete metadata ceilings",
);
assert.match(
  characterRoutesSource,
  /app\.post<\{ Params: \{ id: string \} \}>\("\/:id\/avatar"[\s\S]{0,2400}withCharacterUpdateQueue\(id, async \(\) => \{\s*const validatedData = await validateCharacterGalleryReferences/u,
  "Embedded card updates must serialize writes and validate character-owned gallery references",
);

const professorMariWorkspaceSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/server/src/services/professor-mari/workspace-agent.service.ts"),
  "utf8",
);
assert.match(
  professorMariWorkspaceSource,
  /description is a brief identity overview[\s\S]{0,220}backstory is[^\n]+history[\s\S]{0,180}appearance is physical features/u,
  "Professor Mari's workspace prompt must teach smaller models the distinct character-card field meanings",
);
assert.match(
  professorMariWorkspaceSource,
  /Updates are patches[\s\S]{0,400}Read the entity back[\s\S]{0,300}Claim completion only when every requested value matches/u,
  "Professor Mari must preserve unrelated fields and verify requested character edits before claiming completion",
);
const professorMariSeedSource = readFileSync(join(REPOSITORY_ROOT, "packages/server/src/db/seed-mari.ts"), "utf8");
assert.match(
  professorMariSeedSource,
  /Keep card fields distinct:[\s\S]{0,600}fetch the character again/u,
  "The seeded Professor Mari command guide must retain the same targeted character-field safeguards",
);

assert.deepEqual(HOME_CHAT_MODE_ACCENTS, {
  conversation: "oklch(0.79 0.16 205)",
  roleplay: "oklch(0.76 0.19 52)",
  game: "var(--marinara-mode-game-accent)",
});

const lorebookEnglishLocale = JSON.parse(
  readFileSync(join(REPOSITORY_ROOT, "packages/client/src/localization/locales/en.json"), "utf8"),
) as Record<string, unknown>;
const updatesRouteSource = readFileSync(join(REPOSITORY_ROOT, "packages/server/src/routes/updates.routes.ts"), "utf8");
assert.match(
  updatesRouteSource,
  /gitInstall \? await getCurrentBranch\(root\)\.catch\(\(\) => null\) : getBuildBranch\(\)/u,
);
assert.match(updatesRouteSource, /const currentChannel = await getUpdateChannelForCheckout\(root, currentBranch\)/u);

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

const personalExtensionInjectorSource = readFileSync(
  new URL("../../packages/client/src/components/layout/PersonalExtensionInjector.tsx", import.meta.url),
  "utf8",
);
assert.match(personalExtensionInjectorSource, /fetch: \(input, init\) => fetchForPersonalExtension/u);
const personalExtensionSettingsSource = readFileSync(
  new URL("../../packages/client/src/components/panels/settings/PersonalExtensionsSettings.tsx", import.meta.url),
  "utf8",
);
assert.match(personalExtensionSettingsSource, /settings\.personalExtensions\.traffic\.summary/u);

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
const conversationGenerationSource = readFileSync(
  new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
  "utf8",
);
assert.match(
  conversationGenerationSource,
  /const selectorConnection = \(await connections\.getDefaultForAgents\(\)\) \?\? conn/u,
  "Smart group responder selection must prefer the default Agent connection and fall back to the chat connection",
);
assert.match(
  conversationGenerationSource,
  /resolveStoredMaxTokens\(selectorConnection\.defaultParameters, DEFAULT_AGENT_MAX_TOKENS\)/u,
  "Smart group responder selection must respect the Agent connection token default instead of a 512-token cap",
);
assert.match(
  conversationGenerationSource,
  /resolveStoredChatOptions\([\s\S]{0,180}selectorConnection\.defaultParameters/u,
  "Smart group responder selection must inherit the Agent connection generation parameters",
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
const conversationPresenceSource = readFileSync(
  new URL("../../packages/server/src/routes/generate/conversation-presence-runtime.ts", import.meta.url),
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
const mariMessageActionsSource = mariChatPart("use-mari-message-actions.ts");
const mariWorkspaceRunSource = mariChatPart("use-mari-workspace-run.ts");
const mariChatHistoryActionsSource = mariChatPart("use-mari-chat-history-actions.ts");
const mariWorkTimelineSource = mariChatPart("MariWorkTimeline.tsx");
const compactMariMessageSource = mariChatPart("CompactMariMessage.tsx");
const contextBudgetChatInputSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatInput.tsx", import.meta.url),
  "utf8",
);
const contextBudgetConversationInputSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ConversationInput.tsx", import.meta.url),
  "utf8",
);
const contextBudgetGameInputSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameInput.tsx", import.meta.url),
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
const contextBudgetIndicatorSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ContextBudgetIndicator.tsx", import.meta.url),
  "utf8",
);
const lorebookHooksSource = readFileSync(
  new URL("../../packages/client/src/hooks/use-lorebooks.ts", import.meta.url),
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
  contextBudgetChatInputSource,
  /<ContextBudgetIndicator/u,
  "Roleplay context usage must stay inside the connection switcher",
);
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
assert.match(
  professorMariHomeSource,
  /enterToSendProfessorMari/u,
  "Professor Mari must read her persisted Send on Enter preference",
);
// One composer since the floating-mode branch was removed (f27ce165b). Its keys route through
// composerKeyAction (#7913), which composer-triggers.regression.ts checks case by case.
assert.equal(
  mariChatAllSource.match(/composerKeyAction\(\{/gu)?.length,
  1,
  "Professor Mari's composer must route its keys through composerKeyAction",
);
assert.match(
  readFileSync(new URL("../../packages/client/src/lib/composer-triggers.ts", import.meta.url), "utf8"),
  /if \(input\.enterToSend\) \{\s*if \(!input\.shiftKey\) return modifier \? "queue" : "send";\s*\} else if \(modifier\) \{\s*return input\.shiftKey \? "queue" : "send";/u,
  "Professor Mari's composer must preserve Shift+Enter and require the configured send shortcut",
);
assert.match(professorMariHomeSource, /handleBulkDeleteProfessorChats/u);
assert.match(
  mariMessageActionsSource,
  /const handleEditMessage = useCallback\([\s\S]{0,180}if \(!chatId \|\| isBusy\) return;/u,
  "Professor Mari's first edit after generation must not be rejected by a stale busy ref",
);
// A failed send now keeps the message in the transcript with one Retry card (failRun) and never refills the
// composer; Stop is not a failure, so failRun returns before it shows anything.
assert.match(
  mariWorkspaceRunSource,
  /const failRun = useCallback\(\s*\([^)]*\) => \{\s*if \(isProfessorMariAbortError\(error\)\) return;/u,
  "Stopping Professor Mari must not show a failure",
);
assert.doesNotMatch(
  mariChatAllSource,
  /catch \(error\) \{[^}]*setDraft\(/u,
  "A failed or stopped Professor Mari send must not restore the submitted prompt to the composer",
);
assert.match(
  lorebookHooksSource,
  /useDeleteLorebook\(\)[\s\S]{0,900}invalidateQueries\(\{ queryKey: \["chats"\] \}\)/u,
  "Deleting a lorebook must refresh cached chat metadata so it leaves active context immediately",
);
assert.match(
  mariChatHistoryActionsSource,
  /handleDeleteProfessorChat[\s\S]{0,500}showConfirmDialog/u,
  "Deleting one Professor Mari chat must use the app confirmation dialog",
);
// Every step row, failed ones included, opens to technical details with the tool's output (slice 72
// moved the details into one `technicalDetails` helper that every step row renders).
assert.match(
  mariWorkTimelineSource,
  /const technicalDetails = \(tool: WorkspaceToolCall\) =>[\s\S]{0,600}tool\.output !== null && tool\.output !== undefined \? <pre>/u,
  "Failed workspace tools must reveal their provider output in the transcript",
);

assert.match(
  professorMariHomeSource,
  /messageLoadAbortRef\.current !== controller[\s\S]{0,80}activeChatIdRef\.current !== id/u,
  "Professor Mari message loads must discard stale requests and inactive chat results",
);
assert.match(
  professorMariHomeSource,
  /options\.shouldApply\?\.\(\) === false[\s\S]{0,480}setMessages/u,
  "Professor Mari message loads must recheck an operation guard before applying a response",
);
assert.match(
  mariWorkspaceRunSource,
  /loadMessages\(completedChatId, \{[\s\S]{0,160}workspaceRunIdRef\.current === runId[\s\S]{0,100}activeChatIdRef\.current === completedChatId/u,
  "Professor Mari background refreshes must not overwrite state after a newer operation starts",
);
assert.match(
  professorMariHomeSource,
  // #5725 strengthened this guard: it also rejects responses requested for a
  // previous chat and holds mode fields across pending mode writes.
  /const refreshWorkspaceStatus = useCallback\(\s*async \(shouldApply\?: \(\) => boolean\)[\s\S]{0,800}if \(shouldApply\?\.\(\) === false \|\| activeChatIdRef\.current !== chatIdAtStart\) return status;[\s\S]{0,900}setWorkspaceStatus\(/u,
  "Professor Mari workspace status loads must recheck an operation guard before applying a response",
);
assert.match(
  mariWorkspaceRunSource,
  /refreshWorkspaceStatus\([\s\S]{0,140}workspaceRunIdRef\.current === runId[\s\S]{0,100}activeChatIdRef\.current === completedChatId/u,
  "Professor Mari post-run status refreshes must not overwrite state after a newer operation starts",
);
// The work-stage layout (1a61247d1) replaced the user-message separators with a right-aligned bubble.
assert.match(
  compactMariMessageSource,
  /message\.role === "user"[\s\S]{0,180}<TranscriptRow[^>]*className="mari-user-request/u,
  "Professor Mari user messages must render as the user-request row",
);
assert.match(
  mariChatHistoryActionsSource,
  /Promise\.allSettled\([\s\S]*?api\.delete\(`\/chats\/internal\/professor-mari\/chats\/\$\{id\}`\)/u,
  "Professor Mari chat history should delete all selected chats through the existing endpoint",
);
const roleplaySurfaceSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatRoleplaySurface.tsx", import.meta.url),
  "utf8",
);
const echoChamberPanelSource = readFileSync(
  new URL("../../packages/client/src/components/chat/EchoChamberPanel.tsx", import.meta.url),
  "utf8",
);
const chatFloatingUiEventsSource = readFileSync(
  new URL("../../packages/client/src/lib/chat-floating-ui-events.ts", import.meta.url),
  "utf8",
);
const appShellSource = readFileSync(
  new URL("../../packages/client/src/components/layout/AppShell.tsx", import.meta.url),
  "utf8",
);
const featureAgentDetailHostSource = readFileSync(
  new URL("../../packages/client/src/components/agents/FeatureAgentDetailHost.tsx", import.meta.url),
  "utf8",
);
const guidedPresetEditorSource = readFileSync(
  new URL("../../packages/client/src/components/presets/PresetEditor.tsx", import.meta.url),
  "utf8",
);
const presetPanelSource = readFileSync(
  new URL("../../packages/client/src/components/panels/PresetsPanel.tsx", import.meta.url),
  "utf8",
);
const chatMessageSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatMessage.tsx", import.meta.url),
  "utf8",
);
const assignedSweepChatAreaSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatArea.tsx", import.meta.url),
  "utf8",
);
assert.match(assignedSweepChatAreaSource, /export const ChatArea = memo\(function ChatArea/u);
assert.doesNotMatch(assignedSweepChatAreaSource, /updateMessage(?:Extra)?\.mutate/u);
assert.match(chatMessageSource, /mari-chrome-accent-progress mari-accent-animated mb-1\.5 h-0\.5/u);
assert.match(
  chatMessageSource,
  /function ConversationStartMarkers[\s\S]*className=\{cn\("w-full", panel \? "mb-1 px-1" : "mb-0\.5 px-2"\)\}/u,
  "Roleplay New Start dividers must span user and assistant message bodies",
);
assert.match(chatMessageSource, /pointer-events-auto relative z-30 flex h-11 w-11/u);
assert.equal(
  chatMessageSource.match(/\(showActions \|\| editing\) && "opacity-100"/gu)?.length,
  2,
  "Editing must keep every Roleplay and Game message action visible",
);
assert.equal(
  roleplaySurfaceSource.match(/data-roleplay-agent-window/gu)?.length,
  3,
  "Roleplay must identify both HUD layouts and package-provided agent surfaces",
);
assert.match(
  echoChamberPanelSource,
  /const rootAttributes = \{[^}]*"data-roleplay-agent-window": "echo"[^}]*\}/u,
  "Echo Chamber should retain its marker for mobile composer visibility",
);
assert.match(
  echoChamberPanelSource,
  /<FloatingWindow[\s\S]*?rootAttributes=\{rootAttributes\}/u,
  "the Echo Chamber window and desktop bubble must share the mobile edit marker",
);
assert.match(
  echoChamberPanelSource,
  /<WindowBubble[\s\S]*?attributes=\{\{ \.\.\.rootAttributes,/u,
  "the collapsed phone Echo Chamber button must retain the mobile edit marker",
);
assert.match(assignedSweepChatAreaSource, /mari-chrome-accent-text-muted mari-accent-animated max-w-sm text-xs/u);
const macroTextareaSource = readFileSync(
  new URL("../../packages/client/src/components/ui/MacroTextarea.tsx", import.meta.url),
  "utf8",
);
const roleplayHudSource = readFileSync(
  new URL("../../packages/client/src/components/chat/RoleplayHUD.tsx", import.meta.url),
  "utf8",
);
const cyoaChoicesSource = readFileSync(
  new URL("../../packages/client/src/components/chat/CyoaChoices.tsx", import.meta.url),
  "utf8",
);
const spriteOverlaySource = readFileSync(
  new URL("../../packages/client/src/components/chat/SpriteOverlay.tsx", import.meta.url),
  "utf8",
);
const spritesRoutesSource = readFileSync(
  new URL("../../packages/server/src/routes/sprites.routes.ts", import.meta.url),
  "utf8",
);
const narratorUiStoreSource = readFileSync(
  new URL("../../packages/client/src/stores/ui.store.ts", import.meta.url),
  "utf8",
);
assert.match(
  appShellSource,
  /onOpenChatSummarySettings:[\s\S]{0,180}onOpenActivePromptPresetEditor:/u,
  "Feature detail capability props must expose both guided onboarding navigation callbacks",
);
assert.match(
  appShellSource,
  /resolveFeatureAgentPackage\(selectedFeatureAgent, installedCapabilities\.data \?\? \[\]\)/u,
);
assert.match(featureAgentDetailHostSource, /mari-editor-shell mari-editor-legacy-bridge/u);
assert.match(featureAgentDetailHostSource, /<AgentDetailHeader\b/u);
assert.doesNotMatch(featureAgentDetailHostSource, /\bPuzzle\b/u);
assert.doesNotMatch(featureAgentDetailHostSource, /featureagentdetailhost\.feature"/u);
assert.match(
  chatFloatingUiEventsSource,
  /CHAT_SUMMARY_OPEN_REQUEST_EVENT[\s\S]{0,240}detail:\s*\{\s*chatId\s*\}/u,
  "Summary requests must carry the target chat ID",
);
// Chat Summary is a Chat Settings drawer, so a request opens Chat Settings there (desktop window or phone sheet).
assert.match(
  assignedSweepChatAreaSource,
  // One listener table now serves the summary, lorebook-entries and search drawers (omnibar chat tool rows).
  /\[CHAT_SUMMARY_OPEN_REQUEST_EVENT, "summary"\][\s\S]{0,400}chatId !== useChatStore\.getState\(\)\.activeChatId\) return;\s*handleOpenSettingsPanel\(undefined, \{ initialSection \}\)/u,
  "Summary requests must open Chat Settings at the Chat Summary drawer for the active chat only",
);
assert.match(
  narratorUiStoreSource,
  /openPresetDetail: \(id, options\)[\s\S]{0,180}presetDetailInitialTab: options\?\.initialTab \?\? null/u,
  "Preset navigation must retain an optional initial tab request",
);
assert.match(
  guidedPresetEditorSource,
  /presetDetailInitialTab[\s\S]{0,260}setActiveTab\(presetDetailInitialTab \?\? "overview"\)/u,
  "PresetEditor must consume the requested initial tab and retain Overview by default",
);
assert.match(
  presetPanelSource,
  /openPresetDetail\(preset\.id\)/u,
  "Ordinary preset-panel navigation must continue using the default Overview tab",
);
assert.equal(
  roleplaySurfaceSource.match(/mergedGroupCharacterIds=\{activeChatCharacterIds\}/gu)?.length,
  6,
  "Classic and VN historical, regenerating, and streaming Narrator messages must all receive the live active roster; saved replies keep their own (#8762)",
);
assert.match(
  chatMessageSource,
  /const cycleMergedNarratorAvatars = \(!isRoleplay \|\| roleplayNarratorAvatarCycling\) && !reduceAmbientEffects;/u,
  "Narrator avatar cycling must follow the Roleplay preference and stop with reduced ambient effects",
);
assert.match(
  macroTextareaSource,
  /const valueRef = useRef\(value\);[\s\S]{0,500}\}, \[open\]\);/u,
  "Expanded macro editors must only initialize and focus when opened, not after every parent value update",
);
assert.match(
  chatMessageSource,
  /aria-label=\{localizeUi\("ui\.chat\.edittextarea\.saveEdit"\)\}[\s\S]{0,180}h-11 w-11/u,
  "The Roleplay edit Save control must keep a full touch-sized hit target",
);
assert.equal(
  roleplayHudSource.match(/!reduceAmbientEffects && "animate-\[inventory-cycle_0\.4s_ease-out\]"/gu)?.length,
  1,
  "The dedicated Roleplay Inventory Tracker widget must suppress mount animations with reduced ambient effects",
);
// Clear Trackers is shared by every Agent activity section (Chat Settings, Trackers window, Tracker Panel).
assert.match(
  readFileSync(new URL("../../packages/client/src/hooks/use-agent-activity.ts", import.meta.url), "utf8"),
  /latestAssistantMessage[\s\S]{0,240}extra: \{ cyoaChoices: \[\] \}/u,
  "clearing Roleplay tracker state must also clear the persisted active CYOA prompt",
);
assert.match(
  cyoaChoicesSource,
  /extra: \{ cyoaChoices: \[\] \}[\s\S]{0,900}if \(impersonated\)[\s\S]{0,160}connectionId: null/u,
  "selecting a CYOA prompt must consume it permanently and follow impersonation with a character reply",
);
assert.match(
  spriteOverlaySource,
  /const stageZIndexClass = editing \? "z-\[35\]" : "z-\[5\]"/u,
  "non-editing sprites must remain below the Roleplay transcript and its CYOA controls",
);
assert.match(
  assignedSweepChatAreaSource,
  /savedUrl \?\? \(chat\.mode === "roleplay" \? useUIStore\.getState\(\)\.defaultRoleplayBackground : null\)/u,
  "new Roleplay chats must inherit the explicitly selected default background",
);
assert.match(
  spritesRoutesSource,
  /const backupDir = join\(dir, "\.cleanup-backups", backupId\)[\s\S]{0,1800}copyFile\(inputPath, join\(backupDir, filename\)\)[\s\S]{0,500}writeFile\(outputPath, output\.buffer\)/u,
  "sprite cleanup must keep the original outside the active sprite set while the cleaned file becomes active",
);
assert.match(
  chatMessageSource,
  /\[cycleMergedNarratorAvatars, isMergedGroup, mergedCycleKey, mergedAvatars\.length, mergedNameColors\.length\]/u,
  "Narrator cycling must reset when active character IDs change without changing count",
);
assert.match(
  chatMessageSource,
  /const applyMergedCycleIndex = \(index: number\) => \{[\s\S]{0,1200}applyMergedCycleIndex\(0\);/u,
  "Narrator cycling must immediately apply its reset index to avatar and name opacity",
);
assert.match(
  chatMessageSource,
  /const mergedNameColors = useMemo\(\(\) => mergedAvatars\.map\(\(avatar\) => avatar\.nameColor\)/u,
  "Merged Narrator avatar and name-color indexes must come from the same renderable character list",
);
assert.match(
  chatMessageSource,
  /mergedNameColors\.length === 0 \? \([\s\S]{0,180}<NameColorText color=\{msgNameColor\}>\{localizeUi\("ui\.chat\.chatmessage\.narrator"\)\}/u,
  "Merged messages must retain a Narrator label when no active character avatar resolves",
);
assert.match(
  chatMessageSource,
  /useCompactRectangleAvatar \|\| !cycleMergedNarratorAvatars[\s\S]{0,180}rectangleSafeCropStyle/u,
  "Static compact Narrator avatars must not receive positioned crop dimensions that break their flex layout",
);
assert.match(
  chatMessageSource,
  /cycleMergedNarratorAvatars \? "absolute inset-0 w-full" : "relative w-0 min-w-0 flex-1"/u,
  "Disabling Narrator cycling must place active avatars together",
);
assert.match(
  narratorUiStoreSource,
  /roleplayNarratorAvatarCycling:\s*true/u,
  "Narrator avatar cycling must remain enabled by default",
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
assert.match(
  conversationPresenceSource,
  /deferPresenceDelayToResponders[\s\S]{0,2500}responderDelays = Object\.fromEntries/u,
  "individual Conversation presence should retain one delay per responder instead of waiting on the worst status",
);
assert.match(
  conversationGenerationSource,
  /remainingConversationPresenceDelay\([\s\S]{0,1200}type: "delayed"[\s\S]{0,1200}waitForConversationPresenceDelay[\s\S]{0,4000}type: "typing"/u,
  "individual Conversation generation should wait only when the current responder's delay remains",
);
assert.match(
  conversationGenerationSource,
  /knownConversationMessageIds = new Set\(\s*scopedMessages\s*\.filter\(\(message: any\) => !supportsHiddenFromAI \|\| !isMessageHiddenFromAI\(message\)\)/u,
  "Conversation responder refreshes should seed known IDs from the full visible scope, not truncated context",
);
assert.match(
  conversationGenerationSource,
  /await waitForConversationPresenceDelay\(remainingDelayMs, generationSignal\);\s*if \(generationSignal\.aborted\) break;\s*\}\s*if \(responderDelay\) \{\s*const refreshedMessages = await chats\.listMessages/u,
  "delayed Conversation responders should refresh user history even when an earlier reply consumed their wait",
);
assert.match(
  conversationGenerationSource,
  /Choose one or more available characters[\s\S]{0,500}current schedule status[\s\S]{0,500}talkativeness/u,
  "Conversation Smart ordering should use a schedule-aware selector prompt",
);
assert.match(
  conversationGenerationSource,
  /smartResponseQueue\?\.length\s*\? \[\.\.\.smartResponseQueue\]/u,
  "Smart ordering should generate every character selected by the responder queue",
);
assert.match(
  conversationGenerationSource,
  /In a larger group, do not default to one responder merely because the group is large/u,
  "Conversation Smart ordering should not bias larger groups toward one responder",
);
assert.match(
  conversationGenerationSource,
  /scanConversationLorebooks[\s\S]{0,1000}characterIds: withIdentityLorebookScope\(targetCharacterIds\)/u,
  "Individual Conversation lorebook scans should use the current responder and character-backed user identity tags",
);
assert.match(
  conversationGenerationSource,
  /prepareConversationLorebookForResponder[\s\S]{0,1000}scanConversationLorebooks\(\[targetCharId\], \{ previewOnly: true \}\)/u,
  "Individual Conversation lorebook scans should receive only the current responder ID",
);
assert.match(
  conversationGenerationSource,
  /let gameAwareMessagesForGen = await prepareConversationLorebookForResponder\(targetCharId, messagesForGen\)/u,
  "Individual Conversation lorebook injection should happen separately for each provider generation",
);
assert.match(
  readFileSync(new URL("../../packages/server/src/routes/generate/reply-text-cleanup.ts", import.meta.url), "utf8"),
  /chatMode === "conversation" && otherNames\.length > 0[\s\S]{0,500}fullResponse = fullResponse\.slice\(0, nextSpeakerMatch\.index\)/u,
  "Individual Conversation generations should discard an extra character turn returned in the same completion",
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
assert.match(
  foregroundAutonomousSource,
  /triggerAutonomousGeneration\(exchange\.characterIds\[0\]!\)/u,
  "Character Exchanges should start a separate targeted Individual generation",
);
assert.match(
  conversationGenerationSource,
  /explicitlyMentionedConversationCharacterIds\.length > 0\s*\? explicitlyMentionedConversationCharacterIds/u,
  "explicit Conversation mentions should select the mentioned responders before the stored response order",
);
assert.match(
  conversationGenerationSource,
  /resolveIllustratorImageSize\(\s*requestChatMode === "game" \? imageSettings\.game : imageSettings\.illustration,\s*illData\.aspectRatio/u,
  "automatic Illustrator generation should use the Game scene canvas in Game mode and preserve the shared orientation resolver",
);
// R11: the composer cap is its CSS max-height now (8 lines, 6 on touch), not a hard-coded 128 px.
assert.match(
  professorMariHomeSource,
  /const cap = Number\.parseFloat\(getComputedStyle\(textarea\)\.maxHeight\);\s*const to = Number\.isFinite\(cap\) \? Math\.min\(textarea\.scrollHeight, cap\)/u,
  "Professor Mari's composer must stop growing at its max-height",
);
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
assert.equal(
  roleplaySurfaceSource.match(/object-cover object-center/gu)?.length,
  2,
  "both crossfade slots should cover their surface without stretching the background",
);

const appSource = readFileSync(new URL("../../packages/client/src/App.tsx", import.meta.url), "utf8");
const homeBrowserHubSource = readFileSync(
  new URL("../../packages/client/src/components/chat/HomeBrowserHub.tsx", import.meta.url),
  "utf8",
);
assert.match(
  homeBrowserHubSource,
  /<MessageCircle size="0\.8rem" className="mari-rgb-static-icon text-current" \/>/u,
  "The Your Guide action icon must inherit the same color as its label",
);
assert.equal(
  appSource.match(/document\.addEventListener\("visibilitychange", syncEffectsPausedState\)/gu)?.length,
  1,
  "Home effect pausing must keep one central visibility listener",
);
assert.match(appSource, /dispatchEvent\(new CustomEvent\("marinara:effects-paused"/u);
const agentEditorSource = readFileSync(
  new URL("../../packages/client/src/components/agents/AgentEditor.tsx", import.meta.url),
  "utf8",
);
const characterEditorSource = readFileSync(
  new URL("../../packages/client/src/components/characters/CharacterEditor.tsx", import.meta.url),
  "utf8",
);
const cardEditorSource = readFileSync(
  new URL("../../packages/client/src/components/cards/CardEditor.tsx", import.meta.url),
  "utf8",
);
const personaEditorSource = readFileSync(
  new URL("../../packages/client/src/components/personas/PersonaEditor.tsx", import.meta.url),
  "utf8",
);
const chatSetupWizardSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatSetupWizard.tsx", import.meta.url),
  "utf8",
);
const setupGenerationParametersStart = chatSetupWizardSource.indexOf("function SetupGenerationParametersPanel");
const chatSetupWizardEnd = chatSetupWizardSource.indexOf("export function ChatSetupWizard");
assert.ok(setupGenerationParametersStart >= 0 && chatSetupWizardEnd > setupGenerationParametersStart);
const setupGenerationParametersSource = chatSetupWizardSource.slice(setupGenerationParametersStart, chatSetupWizardEnd);
const convoProfileFieldsSource = readFileSync(
  new URL("../../packages/client/src/components/characters/ConvoProfileFields.tsx", import.meta.url),
  "utf8",
);
const generationParametersEditorSource = readFileSync(
  new URL("../../packages/client/src/components/ui/GenerationParametersEditor.tsx", import.meta.url),
  "utf8",
);
const kaomojiPickerSource = readFileSync(
  new URL("../../packages/client/src/components/ui/KaomojiPicker.tsx", import.meta.url),
  "utf8",
);
const emojiPickerSource = readFileSync(
  new URL("../../packages/client/src/components/ui/EmojiPicker.tsx", import.meta.url),
  "utf8",
);
const visualViewportChatBottomSource = readFileSync(
  new URL("../../packages/client/src/hooks/use-visual-viewport-chat-bottom.ts", import.meta.url),
  "utf8",
);
const spriteDownloadSource = readFileSync(
  new URL("../../packages/client/src/lib/sprite-download.ts", import.meta.url),
  "utf8",
);
const gameJournalSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameJournal.tsx", import.meta.url),
  "utf8",
);
// The modal renders each variable's options through the shared ChoiceOptionsField.
const choiceSelectionModalSource =
  readFileSync(
    new URL("../../packages/client/src/components/presets/ChoiceSelectionModal.tsx", import.meta.url),
    "utf8",
  ) +
  readFileSync(new URL("../../packages/client/src/components/presets/ChoiceOptionsField.tsx", import.meta.url), "utf8");
const gameSurfaceSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
const gameNarrationSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameNarration.tsx", import.meta.url),
  "utf8",
);
const gameAudioSource = readFileSync(new URL("../../packages/client/src/lib/game-audio.ts", import.meta.url), "utf8");
const gameSetupWizardSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameSetupWizard.tsx", import.meta.url),
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
  /lorebookReadBehindMessages:\s*localLorebookReadBehindMessages/u,
  "Custom lorebook writer settings must persist Read Behind",
);
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
const conversationInputSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ConversationInput.tsx", import.meta.url),
  "utf8",
);
const gameRoutesSource = readFileSync(
  new URL("../../packages/server/src/routes/game.routes.ts", import.meta.url),
  "utf8",
);
const backupRoutesSource = readFileSync(
  new URL("../../packages/server/src/routes/backup.routes.ts", import.meta.url),
  "utf8",
);
const promptMacroContextSource = readFileSync(
  new URL("../../packages/server/src/services/prompt/macro-context.ts", import.meta.url),
  "utf8",
);
const lorebookServiceSource = readFileSync(
  new URL("../../packages/server/src/services/lorebook/index.ts", import.meta.url),
  "utf8",
);
const serverAppSource = readFileSync(new URL("../../packages/server/src/app.ts", import.meta.url), "utf8");
const backupGuideSource = readFileSync(new URL("../../docs/data/backup-and-restore.md", import.meta.url), "utf8");
const gameAssetBrowserSource = readFileSync(
  new URL("../../packages/client/src/components/game-assets/GameAssetsBrowserView.tsx", import.meta.url),
  "utf8",
);
const gameAssetActionDropdownSource = readFileSync(
  new URL("../../packages/client/src/components/game-assets/ActionDropdown.tsx", import.meta.url),
  "utf8",
);
const gameAssetHooksSource = readFileSync(
  new URL("../../packages/client/src/hooks/use-game-assets.ts", import.meta.url),
  "utf8",
);
const sidecarStoreSource = readFileSync(
  new URL("../../packages/client/src/stores/sidecar.store.ts", import.meta.url),
  "utf8",
);
const sidecarProcessSource = readFileSync(
  new URL("../../packages/server/src/services/sidecar/sidecar-process.service.ts", import.meta.url),
  "utf8",
);
const connectionsPanelSource = readFileSync(
  new URL("../../packages/client/src/components/panels/ConnectionsPanel.tsx", import.meta.url),
  "utf8",
);
const deviceDetailSource = readFileSync(
  new URL("../../packages/client/src/components/connections/DeviceDetail.tsx", import.meta.url),
  "utf8",
);
const transcriptWindowControlsSource = readFileSync(
  new URL("../../packages/client/src/components/chat/TranscriptWindowControls.tsx", import.meta.url),
  "utf8",
);
const localMusicPlayerSource = readFileSync(
  new URL("../../packages/client/src/components/chat/LocalMusicPlayer.tsx", import.meta.url),
  "utf8",
);
const localNotificationsSource = readFileSync(
  new URL("../../packages/client/src/lib/local-notifications.ts", import.meta.url),
  "utf8",
);
const notificationSettingsSource = readFileSync(
  new URL("../../packages/client/src/components/panels/settings/SettingControls.tsx", import.meta.url),
  "utf8",
).replace(/\r\n/gu, "\n");
const chatGallerySource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatGallery.tsx", import.meta.url),
  "utf8",
);
const recentChatsSource = readFileSync(
  new URL("../../packages/client/src/components/chat/RecentChats.tsx", import.meta.url),
  "utf8",
);
const galleryHooksSource = readFileSync(
  new URL("../../packages/client/src/hooks/use-gallery.ts", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(new URL("../../packages/client/src/styles/globals.css", import.meta.url), "utf8");
const galleryRoutesSource = readFileSync(
  new URL("../../packages/server/src/routes/gallery.routes.ts", import.meta.url),
  "utf8",
);
const gameAssetsRoutesSource = readFileSync(
  new URL("../../packages/server/src/routes/game-assets.routes.ts", import.meta.url),
  "utf8",
);
const conversationSelfieRuntimeSource = readFileSync(
  new URL("../../packages/server/src/services/generation/conversation-selfie-command-runtime.ts", import.meta.url),
  "utf8",
);
const illustratorReferencesSource = readFileSync(
  new URL("../../packages/server/src/services/image/illustrator-references.ts", import.meta.url),
  "utf8",
);
assert.match(appSource, /--marinara-app-accent-static-gradient/u);
// While the omnibar is open, toasts move to the edge it does not cover; otherwise the user's position applies.
assert.match(
  appSource,
  /position=\{\s*omnibarOpen\s*\?[^:]+:[^:]+:\s*notificationPosition === "bottom"\s*\? "bottom-center"\s*: "top-center"\s*\}/u,
);
assert.match(
  appSource,
  /swipeDirections=\{\[\s*"left",\s*"right",\s*omnibarOpen \? \(isMobileShell \? "top" : "bottom"\) : notificationPosition === "bottom" \? "bottom" : "top",\s*\]\}/u,
);
assert.match(agentEditorSource, /api\.post<[^>]+>\(["']\/game-assets\/pick-local-music-folder["']\)/u);
assert.match(localMusicPlayerSource, /api\.raw\(`\/game-assets\/local-music-file\?path=\$\{encodedPath\}`\)/u);
assert.match(localMusicPlayerSource, /URL\.createObjectURL\(await response\.blob\(\)\)/u);
assert.match(localMusicPlayerSource, /URL\.revokeObjectURL/u);
assert.doesNotMatch(localMusicPlayerSource, /return `\/api\/game-assets\/local-music-file/u);
assert.match(gameAssetsRoutesSource, /app\.get\("\/local-music-file"/u);
assert.match(gameAssetsRoutesSource, /const \{ path: encoded \} = \(req\.query as \{ path\?: string \}\)/u);
assert.doesNotMatch(gameAssetsRoutesSource, /app\.get\("\/local-music-file\/:encoded"/u);
assert.match(
  galleryRoutesSource,
  // Anchored at the one scene-video delete route, with bounded lazy gaps so the
  // match cannot span into another handler: ownership check, then the DB row
  // removal with its exact #5611 chat-scoping argument, then the tolerated disk
  // unlink — in that order, all inside this handler.
  /app\.delete<\{ Params: \{ chatId: string; id: string \} \}>\("\/scene-videos\/:chatId\/:id"[\s\S]{0,400}?video\.chatId !== chatId[\s\S]{0,200}?await sceneVideos\.remove\(video\.id, video\.chatId\);[\s\S]{0,120}?await removeSavedVideoFromDisk\(video\.filePath\)\.catch/u,
);
assert.match(galleryHooksSource, /api\.delete\(`\/gallery\/scene-videos\/\$\{chatId\}\/\$\{videoId\}`\)/u);
assert.match(chatGallerySource, /handleDeleteVideo\(video\)/u);
assert.match(chatGallerySource, /ui\.chat\.chatgallery\.deleteSceneVideo/u);
assert.match(chatGallerySource, /const \[selectingImages, setSelectingImages\] = useState\(false\)/u);
assert.match(chatGallerySource, /const selectableImageIds = useMemo/u);
assert.match(chatGallerySource, /handleBatchDownload/u);
assert.match(chatGallerySource, /handleBatchDelete/u);
assert.match(chatGallerySource, /ui\.gallery\.batch\.deletePartial/u);
assert.match(chatGallerySource, /batchOperationPendingRef\.current/u);
assert.equal(
  chatGallerySource.match(/disabled=\{selectedImages\.length === 0 \|\| batchOperationPending\}/gu)?.length,
  2,
  "both chat Gallery batch actions remain disabled while an operation is pending",
);
assert.match(chatGallerySource, /ui\.gallery\.batch\.toggleImageNamed/u);
assert.match(chatGallerySource, /asset\.id\.startsWith\("chat-gallery:"\)[\s\S]{0,120}: asset\.id/u);
assert.match(recentChatsSource, /data-narrow-desktop-limit="4"/u);
assert.match(recentChatsSource, /md:auto-rows-fr md:grid-rows-none/u);
assert.match(recentChatsSource, /index === 3 && "hidden md:block"/u);
assert.match(recentChatsSource, /index >= 4 && "hidden"/u);
for (const editorSource of [characterEditorSource, personaEditorSource]) {
  assert.match(editorSource, /<CardEditor\b/u);
  assert.match(editorSource, /<CardColors\b/u);
  assert.match(editorSource, /grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4/u);
  assert.match(editorSource, /onClick=\{\(\) => void handleDelete\(lightbox\)\}/u);
  assert.match(editorSource, /loading="lazy"\s+decoding="async"/u);
  assert.match(editorSource, /group-\[&:focus-within\]:opacity-100/u);
}
assert.match(characterEditorSource, /await remove\.mutateAsync\(image\.id\)/u);
assert.match(characterEditorSource, /ui\.characters\.charactergallerytab\.failedToDeleteCharacterImage/u);
assert.doesNotMatch(chatGallerySource, /bg-red-500/u);
assert.match(chatGallerySource, /ui\.chat\.chatgallery\.deleteGalleryImage[\s\S]{0,180}mari-chrome-accent-surface/u);
assert.match(
  chatGallerySource,
  /handleDeleteVideo\(video\)[\s\S]{0,240}ui\.chat\.chatgallery\.deleteSceneVideo[\s\S]{0,240}mari-chrome-accent-surface/u,
);
assert.match(
  chatGallerySource,
  /onClick=\{\(\) => handleDelete\(confirmDeleteId\)\}[\s\S]{0,180}mari-chrome-accent-surface/u,
);
assert.match(characterEditorSource, /getAvatarCropStyle/u);
assert.match(characterEditorSource, /downloadSpriteFile/u);
assert.match(personaEditorSource, /downloadSpriteFile/u);
assert.match(
  convoProfileFieldsSource,
  /\{kind === "character" && \(\s*<div className="mari-editor-panel space-y-3 p-3">[\s\S]*?convoBehavior/u,
  "Persona editors must not render the character-only Convo Behavior control",
);
assert.match(
  conversationGenerationSource,
  /isPersona: true,\s*\/\/ Personas represent the user\.[\s\S]{0,180}?behavior: null,/u,
  "Legacy Persona Convo Behavior data must not steer Conversation prompts",
);
assert.match(
  generationParametersEditorSource,
  /placeholder=\{localizeUi\("ui\.ui\.generationparametersfields\.thinking", \{\s*value1: "<",\s*value2: ">",\s*\}\)\.trimStart\(\)\}/u,
  "Assistant Prefill must render literal angle brackets without unbalanced localization markup",
);
assert.match(generationParametersEditorSource, /placeholder:\[text-indent:0\]/u);
for (const [name, source] of [
  ["Emoji", emojiPickerSource],
  ["Kaomoji", kaomojiPickerSource],
] as const) {
  assert.match(
    source,
    /flex items-center gap-2 rounded-md bg-foreground\/5 px-2\.5 py-1\.5 ring-1 ring-foreground\/10 transition-shadow focus-within:ring-foreground\/20/u,
    `${name} search must use the same shell treatment as GIF search`,
  );
  assert.match(source, /text-foreground\/45/u, `${name} search icon must match GIF search`);
  assert.match(source, /placeholder:text-foreground\/35/u, `${name} search placeholder must match GIF search`);
}
assert.match(visualViewportChatBottomSource, /const anchor = pendingAnchor \?\? captureAnchor\(\);/u);
assert.match(
  visualViewportChatBottomSource,
  /scrollElement\.scrollTo\(\{ top: Math\.min\(anchor\.scrollTop, maxScrollTop\), behavior: "auto" \}\);/u,
  "Keyboard opening should restore an intentionally scrolled transcript to its captured position",
);
assert.match(characterEditorSource, /if \(uploading \|\| !expression\) return;/u);
assert.match(personaEditorSource, /if \(uploading \|\| !expression\) return;/u);
assert.match(
  characterEditorSource,
  /className="grid grid-cols-2 items-stretch gap-2 md:flex md:flex-wrap md:items-center"/u,
);
assert.match(personaEditorSource, /className="flex flex-col gap-2 sm:flex-row"/u);
assert.match(spriteDownloadSource, /saveBlobToDevice/u);
assert.match(
  characterEditorSource,
  /<SettingsSwitch\s+checked=\{formData\.extensions\.versioningEnabled !== false\}/u,
  "Character versioning must use the shared aligned settings switch",
);
assert.match(
  personaEditorSource,
  /<SettingsSwitch\s+checked=\{formData\.versioningEnabled\}/u,
  "Persona versioning must use the shared aligned settings switch",
);
assert.match(
  setupGenerationParametersSource,
  /className="flex min-w-0 w-full items-center justify-between gap-3 text-left"[\s\S]*className="min-w-0 flex-1"[\s\S]*"h-5 w-9 shrink-0 rounded-full/u,
  "The New Chat parameter toggle must stay within its card when Android enlarges text",
);
assert.equal(
  cardEditorSource.match(/className="pointer-events-none h-full w-full object-cover"/gu)?.length,
  1,
  "The shared header avatar inside its upload target must not intercept page clicks",
);
assert.match(gameJournalSource, /\/game\/\$\{chatId\}\/journal\/entries\/\$\{editingEntry\.index\}/u);
assert.match(
  gameJournalSource,
  /<TimelineView\s+entries=\{visibleEntries\}\s+onEdit=\{beginEditingEntry\}/u,
  "Game Journal must keep edit controls connected after JSX formatting changes",
);
assert.match(
  gameNarrationSource,
  /const narrationKey = latestAssistant \? `\$\{latestAssistant\.id\}:\$\{latestAssistant\.activeSwipeIndex \?\? 0\}` : null/u,
  "Game rerolls must reset narration when the saved swipe changes on the same message",
);
assert.match(
  gameAudioSource,
  /const fallbackPlays = remainingPlays;[\s\S]*index < fallbackPlays[\s\S]*proceduralSfxTimers\.add\(timer\)/u,
  "Procedural SFX fallback must preserve the bounded number of remaining sequential plays",
);
assert.match(
  gameAudioSource,
  /const generation = this\.sfxGeneration;[\s\S]*generation !== this\.sfxGeneration[\s\S]*proceduralSfxTimers\.add\(timer\)/u,
  "Procedural SFX callbacks must stay scoped to the active Game audio generation",
);
assert.match(
  gameAudioSource,
  /dispose\(\): void \{[\s\S]*sfxGeneration \+= 1;[\s\S]*clearTimeout\(timer\);[\s\S]*el\.onerror = null;[\s\S]*el\.onended = null;/u,
  "Disposing Game audio must invalidate late fallbacks, cancel timers, and detach SFX handlers",
);
assert.match(gameSurfaceSource, /audioManager\.playSfx\(resolved, assetMap, fx\.sfxLoopCount\)/u);
assert.match(
  choiceSelectionModalSource,
  /presentedOptions\.length === 1[\s\S]*<SettingsSwitch[\s\S]*labelPosition="start"/u,
  "Single-option preset variables must use the standard accessible settings switch",
);
// #3624: the Session window embeds the Game Journal, whose tabs scroll only inside a bounded height. The old
// popover's fixed height cap moved to the control windows: a computer's window has a set height, and a phone's
// sheet for content that scrolls itself is pinned top and bottom.
const chatControlWindowSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatControlWindow.tsx", import.meta.url),
  "utf8",
);
const floatingWindowSource = readFileSync(
  new URL("../../packages/client/src/components/ui/FloatingWindow.tsx", import.meta.url),
  "utf8",
);
assert.match(
  gameSurfaceSource,
  /id=\{CHAT_CONTROL_WINDOW_IDS\.session\}[\s\S]{0,400}scroll=\{false\}[\s\S]{0,200}\{renderSessionPanel\(\)\}/u,
  "The Session window must leave scrolling to the Game Journal inside it",
);
assert.match(
  gameSurfaceSource,
  /const renderSessionPanel = \(\) => \{[\s\S]{0,300}<div className="flex min-h-0 flex-1 flex-col overflow-hidden">/u,
  "The Session panel must fill its window as a bounded flex column",
);
assert.match(floatingWindowSource, /height: geometry\.height/u, "A computer's control window must have a set height");
assert.match(
  chatControlWindowSource,
  /sheetClassName=\{cn\(PHONE_SHEET_CLASS, !scroll && PHONE_FULL_SHEET_CLASS\)\}/u,
  "A phone sheet whose content scrolls itself must get a bounded height",
);
assert.match(
  floatingWindowSource,
  /export const PHONE_SHEET_CLASS =\s*"fixed[^"]*top-\[[^"]*max-h-\[[^"]*";\s*export const PHONE_FULL_SHEET_CLASS =\s*"bottom-\[/u,
  "Phone sheets must stay on screen, and the full-height one must pin its bottom",
);
assert.match(gameSetupWizardSource, /ui\.game\.gamesetupwizard\.adjustGameAssetsForThisGame/u);
assert.match(gameSetupWizardSource, /selectFoldersByDefault/u);
assert.match(gameSetupWizardSource, /enableAgents: enableAgents \|\| undefined/u);
assert.match(
  gameSetupWizardSource,
  /handleExportSetup[\s\S]{0,700}buildGameSetupShareFile/u,
  "New Game's final setup step must export the same reusable setup format before starting",
);
assert.match(
  gameSetupWizardSource,
  /id="game-setup-spatial-map-target-count"[\s\S]{0,180}min=\{1\}[\s\S]{0,120}max=\{SPATIAL_CUSTOM_TARGET_LOCATION_LIMIT\}/u,
  "New Game AI map setup must expose the bounded custom place target from World Maps",
);
assert.match(
  gameSetupWizardSource,
  /targetLocationCount:\s*spatialMapTargetLocationCount/u,
  "New Game setup must preserve the selected custom place target in its post-setup map plan",
);
assert.match(
  gameSetupWizardSource,
  /setSpatialMapTargetLocationCount\(importedSpatialMapDraftOptions\.targetLocationCount\)/u,
  "New Game setup imports must restore the saved World Maps place target",
);
assert.match(
  gameSetupWizardSource,
  /setSpatialMapGroundingMode\(config\.spatialMapGroundingMode \?\? "setup"\)/u,
  "New Game setup imports must restore the saved World Maps grounding mode",
);
assert.match(
  gameSurfaceSource,
  /targetLocationCount:\s*plan\.targetLocationCount/u,
  "Game setup must send the custom place target to World Maps draft generation",
);
assert.match(gameRoutesSource, /enableAgents: z\.boolean\(\)\.optional\(\)/u);
assert.match(
  gameRoutesSource,
  /spatialMapTargetLocationCount: z\.number\(\)\.int\(\)\.min\(1\)\.max\(40\)\.optional\(\)/u,
);
assert.match(gameRoutesSource, /enableAgents: setupConfig\.enableAgents === true/u);
assert.match(gameRoutesSource, /gameStoryboardsEnabled: setupConfig\.gameStoryboardsEnabled/u);
assert.equal(
  gameRoutesSource.match(/const conclusionTimeoutMs = getChatGenerationTimeoutMs\(\);/gu)?.length,
  2,
  "Game session conclusion and regeneration must read the configured chat timeout",
);
assert.equal(
  gameRoutesSource.match(/withLlmRequestTimeout\(conclusionTimeoutMs/gu)?.length,
  2,
  "Game session conclusion requests must scope provider body timeouts to the configured chat timeout",
);
assert.match(
  gameRoutesSource,
  /if \(!selectedTemplate\?\.promptTemplate\.trim\(\)\) \{[\s\S]*The Storyboard Agent has no/u,
);
assert.match(chatSettingsDrawerSource, /setFirstMesConfirm\(null\);[\s\S]*addSilentGreetingSwipes/u);
assert.equal(
  chatSettingsDrawerSource.match(/<GenerationSettingsLink/gu)?.length,
  3,
  "generation settings navigation should use one shared control in all three locations",
);
assert.equal(
  conversationInputSource.match(/createDurableMessageWithRollback\(\{/gu)?.length,
  2,
  "presence-delay and post-only persistence should share the rollback helper",
);
assert.match(backupRoutesSource, /tolerateSourceChanges: true/u);
assert.match(backupRoutesSource, /record\.usesDataDescriptor \? 0x0808 : 0x0800/u);
assert.match(backupRoutesSource, /PROFILE_IMPORT_ARCHIVE_LIMIT_BYTES = 2 \* 1024 \* 1024 \* 1024/u);
assert.match(
  backupRoutesSource,
  /limits: \{ fields: 0, parts: 1, files: 1,/u,
  "profile archive imports must accept only one file part",
);
assert.match(
  backupRoutesSource,
  /contentLength > PROFILE_IMPORT_BODY_LIMIT_BYTES[\s\S]*Profile import JSON exceeds the upload limit/u,
  "JSON profile imports must keep the smaller body limit",
);
assert.match(backupRoutesSource, /PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES = 2 \* 1024 \* 1024 \* 1024/u);
assert.match(
  backupRoutesSource,
  /lastOmittedEntries: limitAutomaticBackupOmissionHistory\(settings\.lastOmittedEntries\)/u,
);
assert.match(
  promptMacroContextSource,
  /macroSources\.some\(\(source\) => \/\\\{\\\{\\s\*lorebooksize::\/iu\.test\(source\)\)[\s\S]*countAllEntriesByLorebook/u,
  "prompt macro contexts must only scan lorebook counts when a source uses lorebooksize",
);
assert.match(
  lorebookServiceSource,
  /allEntries\.some\(\(entry\) => \/\\\{\\\{\\s\*lorebooksize::\/iu\.test\(entry\.content\)\)[\s\S]*countAllEntriesByLorebook/u,
  "lorebook scans must only count all entries when relevant content uses lorebooksize",
);
assert.match(serverAppSource, /const clientIndex = resolve\(clientDist, "index\.html"\)/u);
assert.match(serverAppSource, /if \(existsSync\(clientIndex\)\)/u);
assert.match(
  backupRoutesSource,
  /if \(automaticBackupRunning\) return;\s*automaticBackupRunning = true;\s*try \{\s*const settings = await loadAutomaticBackupSettings\(\);/u,
);
assert.match(
  backupRoutesSource,
  /catch \(error\) \{\s*const message = getBackupErrorMessage[\s\S]*try \{[\s\S]*await saveAutomaticBackupSettings[\s\S]*catch \(settingsError\)[\s\S]*Could not persist the automatic backup failure state/u,
  "automatic-backup error reporting must not reject when its settings write also fails",
);
assert.match(
  backupRoutesSource,
  /const hasAutomaticBackup = await automaticBackupExists\(backupsRoot\);[\s\S]*runAutomaticBackupIfDue\(!current\.enabled \|\| !hasAutomaticBackup\)/u,
  "enabling automatic backups or repairing a missing archive should run immediately",
);
assert.doesNotMatch(backupGuideSource, /Export profile as ZIP\?/u);
assert.match(gameAssetBrowserSource, /createPortal/u);
assert.match(gameAssetActionDropdownSource, /createPortal/u);
assert.match(gameAssetActionDropdownSource, /window\.innerWidth - rect\.width/u);
assert.match(gameAssetHooksSource, /invalidateQueries\(\{ queryKey: gameAssetKeys\.all \}\)/u);
assert.doesNotMatch(sidecarStoreSource, /readSseData|Best-effort delete|Best-effort unload/u);
assert.match(sidecarProcessSource, /if \(this\.manuallyUnloaded\) \{/u);
assert.match(sidecarProcessSource, /this\.manuallyUnloaded = false;\s*this\.clearStartupFailure\(\)/u);
assert.match(deviceDetailSource, /connections\.device\.whisper\.deleteFailed/u);
assert.match(deviceDetailSource, /connections\.device\.unloadModel/u);
assert.match(deviceDetailSource, /connections\.device\.loadModel/u);
assert.match(
  connectionsPanelSource,
  /className="grid grid-cols-\[repeat\(auto-fill,minmax\(8\.5rem,1fr\)\)\] gap-2"/u,
  "First-run provider actions must share the panel width in an adaptive grid",
);
assert.match(
  connectionsPanelSource,
  /FIRST_RUN_SERVICES\.map\([\s\S]*?data-add-connection-service=\{service\}[\s\S]*?className="[^"]*min-w-0[^"]*"/u,
  "First-run provider buttons must shrink within their grid cells",
);
assert.equal(
  transcriptWindowControlsSource.match(/className=\{cn\(HISTORY_PAGER_BUTTON_CLASS, buttonClassName\)\}/gu)?.length,
  3,
);
assert.doesNotMatch(transcriptWindowControlsSource, /text-\[var\(--muted-foreground\)\]/u);
assert.match(galleryRoutesSource, /resolveIllustratorPromptRuntime\(\{[\s\S]*chatMetadata: meta/u);
assert.match(
  conversationSelfieRuntimeSource,
  /resolveIllustratorPromptRuntime\(\{[\s\S]*chatMetadata: args\.chatMeta/u,
);
assert.match(
  conversationSelfieRuntimeSource,
  /logDebugOverride\([\s\S]*\[debug\/commands\/selfie\] prompt-builder system/u,
);
assert.match(
  conversationSelfieRuntimeSource,
  /resolveConversationSelfieRequestedNames\(\{[\s\S]{0,400}generationGuide: args\.generationGuide/u,
  "Conversation group selfies must carry the guided request into reference selection",
);
assert.match(
  conversationSelfieRuntimeSource,
  /resolveIllustratorCharacterReferences\(\{[\s\S]{0,800}persona: null,[\s\S]{0,200}requestedNames,[\s\S]{0,300}maxReferences: 6/u,
  "Conversation group selfies must keep all depicted character references without attaching the photographer persona",
);
assert.match(
  conversationSelfieRuntimeSource,
  /selfieResolvedCharacterIds = Array\.from\([\s\S]{0,300}referenceResolution\.characterIds[\s\S]{0,5000}characterIds: selfieResolvedCharacterIds/u,
  "Conversation group selfies must be saved to every depicted character gallery",
);
assert.match(
  illustratorReferencesSource,
  /characterIds: orderedSelectedSources\.map\(\(source\) => source\.id\)/u,
  "Gallery character IDs must retain every depicted character beyond the provider reference-image cap",
);
// The workspace transcript adds its own earlier `.mari-message-content` rule (padding only); check every rule.
const markdownMessageStyles = [...globalStyles.matchAll(/^\.mari-message-content \{[\s\S]*?\}/gmu)]
  .map((match) => match[0])
  .join("\n");
const markdownCodeBlockStyles =
  globalStyles.match(/^\.mari-message-content \.mari-md-codeblock \{[^{}]*\}/mu)?.[0] ?? "";
const markdownCodeChildStyles =
  globalStyles.match(/^\.mari-message-content \.mari-md-codeblock code \{[^{}]*\}/mu)?.[0] ?? "";
assert.match(markdownMessageStyles, /min-width:\s*0;/u);
assert.match(markdownMessageStyles, /max-width:\s*100%;/u);
assert.match(markdownMessageStyles, /overflow-wrap:\s*anywhere;/u);
assert.match(markdownCodeBlockStyles, /box-sizing:\s*border-box;/u);
assert.match(markdownCodeBlockStyles, /width:\s*100%;/u);
assert.match(markdownCodeBlockStyles, /max-width:\s*100%;/u);
assert.match(markdownCodeBlockStyles, /overflow-x:\s*hidden;/u);
assert.match(markdownCodeBlockStyles, /overflow-wrap:\s*anywhere;/u);
assert.match(markdownCodeBlockStyles, /white-space:\s*pre-wrap;/u);
assert.match(markdownCodeChildStyles, /white-space:\s*inherit;/u);
for (const media of globalStyles.matchAll(/^@media \(max-width: 767px\) \{[\s\S]*?^\}/gmu)) {
  assert.doesNotMatch(media[0], /\.mari-message-content \.mari-md-codeblock\b/u);
}
assert.match(localNotificationsSource, /window\.isSecureContext === false/u);
const browserNotificationHelpSource =
  notificationSettingsSource.match(/const browserNotificationHelp =[\s\S]*?;\n/u)?.[0] ?? "";
assert.match(browserNotificationHelpSource, /Browser notifications require HTTPS or localhost/u);
assert.match(browserNotificationHelpSource, /Browser notifications are not available in this environment/u);
assert.match(browserNotificationHelpSource, /Reset this site's notification permission/u);

const chatAreaPromptReviewSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatArea.tsx", import.meta.url),
  "utf8",
);
const gameSurfacePromptReviewSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
const imagePromptReviewModalSource = readFileSync(
  new URL("../../packages/client/src/components/ui/ImagePromptReviewModal.tsx", import.meta.url),
  "utf8",
);
const retryAgentsPromptReviewSource = readFileSync(
  new URL("../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
  "utf8",
);
assert.match(
  agentEditorSource,
  /isCustomImagePromptAgent[\s\S]{0,180}supportsImagePromptSettings/u,
  "Custom Image Prompt agents must expose the shared Illustrator image settings",
);
assert.match(
  conversationGenerationSource,
  /const resultAgent = resolvedAgents\.find[\s\S]{0,300}resultAgent \?\? \(result\.agentType === "illustrator" \? fallbackIllustratorAgent : undefined\)/u,
  "Image generation must use the custom producing agent and reserve Illustrator fallback for Illustrator results",
);
assert.match(
  retryAgentsPromptReviewSource,
  /const resultAgent = resolvedAgents\.find[\s\S]{0,360}resultAgent \?\? \(result\.agentType === "illustrator" \? fallbackIllustratorAgent : undefined\)/u,
  "Image Prompt retries must retain custom agent settings without borrowing Illustrator configuration",
);
assert.match(
  conversationGenerationSource,
  /promptText:\s*\[\s*currentUserInputContent\(\) \?\? ""[\s\S]{0,500}includePersonaWhenMentionedInPrompt: false/u,
  "Roleplay illustrations must resolve depicted characters from the latest user request without attaching an off-camera persona",
);
assert.match(
  retryAgentsPromptReviewSource,
  /promptText:\s*\[[\s\S]{0,180}recentMessages[\s\S]{0,500}includePersonaWhenMentionedInPrompt: false/u,
  "Retried Roleplay illustrations must preserve latest-user character reference detection",
);
const uiStoreSource = readFileSync(new URL("../../packages/client/src/stores/ui.store.ts", import.meta.url), "utf8");
const settingsSyncSource = readFileSync(
  new URL("../../packages/client/src/hooks/use-settings-sync.ts", import.meta.url),
  "utf8",
);
const syncedSettingsSource = uiStoreSource.slice(
  uiStoreSource.indexOf("export function pickSyncedSettings"),
  uiStoreSource.indexOf("export const useUIStore"),
);
assert.match(
  syncedSettingsSource,
  /gameTextEffectsEnabled: state\.gameTextEffectsEnabled/,
  "Game text effects must remain off after synced settings are restored",
);
assert.match(
  settingsSyncSource,
  /hadMissingSyncedSettings[\s\S]*pickSyncedSettings\(useUIStore\.getState\(\)\)/u,
  "Incomplete server settings blobs must be rewritten with newly synced preferences",
);

assert.match(
  uiStoreSource,
  /if \(version <= 37\) \{[\s\S]*IMAGE_STYLE_PROFILES_STORAGE_KEY\] \?\? persisted\.imageStyleProfiles/u,
  "The image-style legacy-key fallback must remain version-specific",
);
assert.match(chatAreaPromptReviewSource, /MEDIA_PROMPT_PREVIEW_TIMEOUT_MS/);
assert.match(chatAreaPromptReviewSource, /confirmConversationSelfiePromptReview/);
assert.match(gameSurfacePromptReviewSource, /if \(imagePromptReviewResolveRef\.current\)/);
assert.match(
  gameSurfacePromptReviewSource,
  /ui\.game\.gamesurfacecomponent\.videoPromptPreviewTimedOutContinuingWithTheDefault/u,
);
assert.match(
  imagePromptReviewModalSource,
  /item\.negativePrompt !== undefined \|\| negativePrompt \? \{ negativePrompt \} : \{\}/,
);
assert.match(retryAgentsPromptReviewSource, /\[debug\/retry-agents\/illustrator\] final prompt/);
assert.match(
  retryAgentsPromptReviewSource,
  /const\s+retryAgentConnectionCache\s*=\s*new\s+Map<string,\s*RetryAgentConnectionResolution>\(\);/,
  "retry agent resolution should reuse provider wrappers for the same stored connection",
);
assert.match(retryAgentsPromptReviewSource, /retryAgentConnectionCache\.get\(connectionId\)/);
assert.match(retryAgentsPromptReviewSource, /retryAgentConnectionCache\.set\(connectionId, resolution\)/);
assert.match(
  retryAgentsPromptReviewSource,
  /\.\.\.normalizeAgentPromptTemplateSelectionMap\(agentPromptTemplateIds\)/,
  "manual retries should apply per-run prompt mode overrides",
);

const chatRoutesSource = readFileSync(join(REPOSITORY_ROOT, "packages/server/src/routes/chats.routes.ts"), "utf8");
assert.match(
  chatRoutesSource,
  /if \(existing\.mode === "conversation" && hasStartedChat\) \{/u,
  "Only Conversation chats should create character membership timeline notices",
);
const summaryPopoverSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/client/src/components/chat/ChatSummaryPanel.tsx"),
  "utf8",
);
assert.match(
  chatRoutesSource,
  /combineChatSummaryEntryHistory\(entries, requestedIds, combinedEntry, now\)/u,
  "The Chat Summary combine route must retain source history through the tested helper",
);
assert.match(
  summaryPopoverSource,
  /onSuccess: \(data\) => \{\s*setSelectedEntryIds\(new Set\(\)\);\s*setShowInactiveSummaries\(true\)/u,
  "The Chat Summary popover must reveal retained inactive sources after combining",
);
assert.match(
  summaryPopoverSource,
  /<[A-Za-z]+\b(?=[^>]*data-summary-entry-root\b)(?=[^>]*onDragOver=\{handleSummaryContainerDragOver\})(?=[^>]*onDrop=\{handleSummaryDrop\})[^>]*>/u,
  "The summary entry list root must be the desktop drag-and-drop container",
);
assert.match(
  summaryPopoverSource,
  /<[A-Za-z]+\b(?=[^>]*data-touch-reorder-item=\{reorderable \? "summary-entry" : undefined\})(?=[^>]*data-touch-reorder-index=\{reorderable \? entryIndex : undefined\})(?=[^>]*draggable=\{reorderable && dragReady\})(?=[^>]*onDragStart=\{onDragStart\})[^>]*>/u,
  "Summary entries must expose a shared desktop and touch reorder surface (the same row is a touch-reorder item, carries its persisted reorder index, and is desktop-draggable)",
);
assert.match(
  summaryPopoverSource,
  /startSummaryEntryTouchDrag\(event, entry\.id/u,
  "Summary entries must support touch drag-and-drop on mobile",
);
assert.match(
  readFileSync(join(REPOSITORY_ROOT, "packages/client/src/lib/touch-reorder.ts"), "utf8"),
  /candidateIndex = readReorderIndex\(candidate\)[\s\S]{0,260}lastIndex = readReorderIndex/u,
  "Touch reorder gaps must use persisted row indexes when filtered entries are not rendered",
);
assert.match(
  summaryPopoverSource,
  /<div className="flex items-center gap-0\.5">[\s\S]{0,900}onMoveUp[\s\S]{0,900}onMoveDown/u,
  "Summary entries must keep keyboard reorder controls available on narrow viewports",
);
assert.match(
  chatRoutesSource,
  /body\.operation === "reorder"[\s\S]{0,1800}body\.entryIds\.map/u,
  "Summary reorder requests must persist the complete user-selected entry order",
);
assert.match(
  summaryPopoverSource,
  /!templateEditorOpen[\s\S]{0,500}\{activeSummaryPrompt\}[\s\S]{0,500}templateEditorOpen/u,
  "The active Chat Summary prompt must remain visible until its template editor opens",
);
assert.doesNotMatch(
  summaryPopoverSource,
  /localizeUi\("ui\.chat\.summarypopover\.templates"\)/u,
  "The Summary Prompt card must use one Edit path instead of a separate Templates button",
);
assert.match(
  summaryPopoverSource,
  /onClick=\{\(\) => void handleToggleVisiblePromptEditor\(\)\}[\s\S]{0,500}aria-expanded=\{visiblePromptEditorOpen\}/u,
  "The Summary Prompt Edit/Done action must expose disclosure semantics for its editor",
);
assert.match(
  summaryPopoverSource,
  /if \(!visiblePromptEditorOpen\) \{\s*setTemplateSelectOpen\(false\);\s*handleEditVisiblePrompt\(\);/u,
  "Opening the Summary Prompt editor must close its template selector",
);
assert.match(
  summaryPopoverSource,
  /const saved = await commitCombinePromptDraft\(\);\s*if \(saved\) setCombinePromptEditorOpen\(false\);/u,
  "Done must save and close the Combine prompt editor",
);
assert.match(
  summaryPopoverSource,
  /if \(promptSettingsSaveLockedRef\.current\) \{\s*await promptSettingsSaveQueueRef\.current;[\s\S]{0,350}combinePromptDraftRef\.current/u,
  "Combine prompt saves must wait for active settings writes and then retry the latest draft",
);
assert.match(
  summaryPopoverSource,
  /queryClient\.getQueryData<ChatSummaryPromptSettings/u,
  "Queued Combine saves must use the latest prompt settings from the query cache",
);
assert.match(
  summaryPopoverSource,
  /const currentSettings = readCurrentPromptSettings\(\);\s*const promise = persistPromptTemplates\(currentSettings\.templates, currentSettings\.activeTemplateId, nextPrompt\);/u,
  "Combine prompt persistence must apply the latest cached templates and active selection",
);
assert.doesNotMatch(
  summaryPopoverSource,
  /promptTemplatesRef|activePromptTemplateIdRef/u,
  "Summary prompt saves must not replay mirrored template state from an earlier render",
);
assert.match(
  summaryPopoverSource,
  /batchAbortControllerRef\.current\?\.abort\(\);\s*void commitCombinePromptDraftRef\.current\(\);/u,
  "Collapsing the Chat Summary drawer or closing Chat Settings must still persist the Combine draft",
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
assert.match(
  chatRoutesSource,
  /requestedSummaryEntryIds[\s\S]{0,6500}combineChatSummaryEntryHistory\(entries, requestedIds, combinedEntry, now\)/u,
  "Combined summaries must replace their selected entries at the first selected chronological position",
);
assert.match(
  chatRoutesSource,
  /estimateChatSummaryTokens\(summaryPrompt\)[\s\S]{0,200}estimateChatSummaryTokens\(combinePrompt\)/u,
  "The combine input budget must reserve the actual system and combine prompt sizes",
);
assert.match(
  chatRoutesSource,
  /combinedSummaryInputBudget[\s\S]{0,500}SUMMARY_COMBINE_MESSAGE_OVERHEAD_TOKENS/u,
  "The combine input budget must reserve message overhead",
);
assert.match(
  chatRoutesSource,
  /estimateChatSummaryTokens\(sourceText\) > combinedSummaryInputBudget[\s\S]{0,500}Selected summaries are too large to combine at once[\s\S]{0,3000}provider\.chatComplete/u,
  "Combined summaries must be rejected before provider generation when they exceed the input budget",
);
const chatSidebarSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/client/src/components/layout/ChatSidebar.tsx"),
  "utf8",
);
assert.match(
  chatSidebarSource,
  /useState<ChatSortOption>\("recent"\)/u,
  "Recent activity must be the default chat sort",
);

assert.match(
  appShellSource,
  /handleTrackerPanelWindowClosed[\s\S]{0,500}trackerPanelWindowTargetRef\.current\?\.popup !== closedTarget\.popup[\s\S]{0,300}closeTrackerPanel\(\)/u,
  "Closing a detached Tracker window must close the Tracker instead of silently docking it",
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

// A closed story ending (Capability API 1.343) stays closed when the game surface mounts again: the close
// is kept in this browser by game and ending, and read back before the ending is shown.
assert.match(gameSurfaceSource, /localStorage\.setItem\(`story-ending-closed:\$\{storyEndingKey\}`, "1"\)/u);
assert.match(gameSurfaceSource, /readIntroPresentedFlag\(`story-ending-closed:\$\{storyEndingKey\}`\)/u);
assert.match(gameSurfaceSource, /storyEndingKey !== storyEndingClosed &&\s*!storyEndingClosedBefore &&/u);

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
