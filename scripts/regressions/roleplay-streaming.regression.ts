import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getRoleplayTypewriterRevealCharsPerSecond,
  getStreamingCharsPerSecond,
  getTypewriterFrameBudget,
  getTypewriterPaintIntervalMs,
  isGenerationSendBlocked,
  isGenerationStartBlocked,
  isMessageShadowedByLiveStream,
  reconcileTypewriterReplacement,
  shouldKeepStreamLiveThroughPostProcessing,
  takeTypewriterCharacters,
} from "../../packages/client/src/lib/generation-stream-policy.js";
import { reconcilePersistedMessages } from "../../packages/client/src/lib/message-cache-reconciliation.js";
import { resolveMessageRewriteVersions } from "../../packages/client/src/lib/message-rewrite-versions.js";
import { resolveMessageReasoningDisplay } from "../../packages/client/src/lib/message-reasoning.js";
import { shouldFormatTextareaQuotes } from "../../packages/client/src/lib/textarea-quotes.js";
import {
  findLatestTTSAutoplayMessage,
  getTTSAutoplayRevision,
  shouldAutoplayGeneratedTTS,
} from "../../packages/client/src/lib/tts-autoplay.js";
import { shouldUsePersistentTTSAudioCache } from "../../packages/client/src/lib/tts-audio-cache.js";
import { getAgentBatchLane, type ResolvedAgent } from "../../packages/server/src/services/agents/agent-pipeline.js";
import { mergePairedBuiltInRewriteAgents } from "../../packages/server/src/services/generation/prose-guardian-settings.js";
import { estimateAgentLoadCost } from "../../packages/shared/src/utils/agent-cost.js";
import {
  DEFAULT_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS,
  enqueueEchoChamberMessages,
  getEchoChamberMessageInterval,
  normalizeEchoChamberMessageDelaySeconds,
  resolveEchoChamberPersistedBaseline,
} from "../../packages/client/src/lib/echo-chamber-queue.js";
import { useAgentStore } from "../../packages/client/src/stores/agent.store.js";
import { advanceWeatherFrameClock } from "../../packages/client/src/lib/weather-frame-clock.js";
import { trackerEditableText } from "../../packages/client/src/features/tracker-panel/lib/tracker-display.js";
import { api, StreamResumeDisconnectError } from "../../packages/client/src/lib/api-client.js";
import { executeAgentBatch } from "../../packages/server/src/services/agents/agent-executor.js";
import { resolveAgentPipelineAgents } from "../../packages/server/src/services/generation/agent-resolution.js";
import {
  BaseLLMProvider,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";
import type { AgentCallDebugEvent, AgentContext } from "../../packages/shared/src/types/agent.js";
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "../../packages/shared/src/constants/security.js";

function readSourceText(url: URL, encoding: "utf8"): string {
  return readFileSync(url, encoding).replace(/\r\n?/gu, "\n");
}

function extractCssBlock(source: string, prelude: string): string {
  const preludeIndex = source.indexOf(prelude);
  assert.notEqual(preludeIndex, -1, `Expected CSS prelude: ${prelude}`);

  const openingBraceIndex = source.indexOf("{", preludeIndex + prelude.length);
  assert.notEqual(openingBraceIndex, -1, `Expected CSS block for: ${prelude}`);

  let depth = 0;
  for (let index = openingBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openingBraceIndex + 1, index);
    }
  }

  assert.fail(`Unclosed CSS block for: ${prelude}`);
}

assert.deepEqual(resolveMessageReasoningDisplay({ thinking: "Visible summary" }), {
  summary: "Visible summary",
  summaryUnavailable: false,
  hasReasoning: true,
});
assert.deepEqual(resolveMessageReasoningDisplay({ generationInfo: { tokensReasoning: 1034 } }), {
  summary: null,
  summaryUnavailable: true,
  hasReasoning: true,
});
assert.deepEqual(resolveMessageReasoningDisplay({ generationInfo: { tokensReasoning: 0 } }), {
  summary: null,
  summaryUnavailable: false,
  hasReasoning: false,
});

const retryAgentRouteSource = readSourceText(
  new URL("../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
  "utf8",
);
const generateRouteSource = readSourceText(
  new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
  "utf8",
);
const useGenerateSource = readSourceText(
  new URL("../../packages/client/src/hooks/use-generate.ts", import.meta.url),
  "utf8",
);
assert.match(
  generateRouteSource,
  /const recordReasoningDuration = \(text: string\) => \{[\s\S]{0,300}text\.trim\(\)[\s\S]{0,300}reasoningDurationMs = Math\.max\(1, Date\.now\(\) - generationStartedAt\);[\s\S]{0,80}\};/u,
  "The server must capture reasoning duration only when visible output begins",
);
assert.match(
  generateRouteSource,
  /const writeContentChunked = async \(text: string\) => \{\s*fullResponse \+= text;\s*if \(holdForTextRewrite\) \{\s*recordReasoningDuration\(text\);/u,
  "Buffered text-rewrite responses must still capture reasoning duration",
);
assert.match(
  generateRouteSource,
  /fullResponse \+= chunk;\s*if \(holdForTextRewrite\) \{\s*recordReasoningDuration\(chunk\);\s*return;/u,
  "Tool-streamed text-rewrite responses must still capture reasoning duration",
);
assert.match(
  generateRouteSource,
  /const val = result\.value;\s*if \(holdForTextRewrite\) \{\s*recordReasoningDuration\(val\);/u,
  "Generator-streamed text-rewrite responses must still capture reasoning duration",
);
const generationInfoPersistenceSource =
  /const extraUpdate: Record<string, unknown> = \{\s*generationInfo: \{[\s\S]*?\n\s*\},\s*\};/u.exec(
    generateRouteSource,
  )?.[0];
assert.ok(generationInfoPersistenceSource, "The committed generation metadata block must remain available");
assert.match(
  generationInfoPersistenceSource,
  /durationMs,\s*reasoningDurationMs,\s*finishReason: finishReason \?\? null,/u,
  "Committed generation metadata must retain the reasoning-only duration",
);
assert.match(
  generateRouteSource,
  /const messagesById = new Map\(preMessages\.map[\s\S]{0,500}\(anchor\.activeSwipeIndex \?\? 0\) !== run\.swipeIndex[\s\S]{0,300}run\.abortController\.abort\(\)/u,
  "Committing a Roleplay turn must cancel agent work anchored to an abandoned swipe",
);
assert.equal(
  (generateRouteSource.match(/moveToActiveAgentRuns\([\s\S]{0,180}lastSavedSwipeIndex/gu) ?? []).length,
  2,
  "Both Roleplay reply-release paths must retain the generated message and swipe anchor",
);
assert.match(
  generateRouteSource,
  /const targets =\s*body\.agentsOnly === true\s*\? agentRuns\s*:/u,
  "Stop Agents must not abort the primary generation before an agent tail detaches",
);
assert.match(
  generateRouteSource,
  /\.\.\.\(input\.submissionId \? \{ submissionId: input\.submissionId \} : \{\}\)/u,
  "The durable user row must retain its client submission ID even when generation fails",
);
const upsertPersistedMessagesSource =
  /export function upsertPersistedMessages\([\s\S]*?\n\}\s*function appendMissingPersistedMessages/u.exec(
    useGenerateSource,
  )?.[0];
assert.ok(upsertPersistedMessagesSource, "The durable-message cache replacement wrapper must remain available");
assert.match(
  upsertPersistedMessagesSource,
  /reconcilePersistedMessages\(old, sortedIncoming\)/u,
  "The durable-message cache replacement wrapper must delegate to the behaviorally proved reconciler",
);
const reconciledMessages = reconcilePersistedMessages(
  {
    pageParams: [undefined],
    pages: [
      [
        {
          id: "persisted-unrelated",
          chatId: "chat-reconciliation-proof",
          role: "assistant",
          characterId: "character-1",
          content: "Unrelated persisted response",
          activeSwipeIndex: 0,
          createdAt: "2026-08-14T12:00:00.000Z",
          extra: {},
        },
        {
          id: "__optimistic_matching",
          chatId: "chat-reconciliation-proof",
          role: "user",
          characterId: null,
          content: "Optimistic matching prompt",
          activeSwipeIndex: 0,
          createdAt: "2026-08-14T12:01:00.000Z",
          extra: { submissionId: "submission-matching" },
        },
        {
          id: "__optimistic_unmatched",
          chatId: "chat-reconciliation-proof",
          role: "user",
          characterId: null,
          content: "Optimistic unmatched prompt",
          activeSwipeIndex: 0,
          createdAt: "2026-08-14T12:02:00.000Z",
          extra: { submissionId: "submission-unmatched" },
        },
      ],
    ],
  },
  [
    {
      id: "durable-matching",
      chatId: "chat-reconciliation-proof",
      role: "user",
      characterId: null,
      content: "Earlier durable server content",
      activeSwipeIndex: 0,
      createdAt: "2026-08-14T12:01:00.000Z",
      extra: { submissionId: "submission-matching" },
    },
    {
      id: "durable-matching",
      chatId: "chat-reconciliation-proof",
      role: "user",
      characterId: null,
      content: "Literal durable server content",
      activeSwipeIndex: 0,
      createdAt: "2026-08-14T12:01:00.000Z",
      extra: { submissionId: "submission-matching" },
    },
  ],
).pages.flat();
assert.deepEqual(
  reconciledMessages.map((message) => message.id),
  ["persisted-unrelated", "durable-matching", "__optimistic_unmatched"],
  "The matching durable user row must replace only its optimistic submission in cache order",
);
assert.equal(
  reconciledMessages.filter((message) => message.id === "durable-matching").length,
  1,
  "The durable replacement must appear exactly once",
);
assert.equal(
  reconciledMessages.find((message) => message.id === "durable-matching")?.content,
  "Literal durable server content",
);
assert.equal(
  reconciledMessages.some((message) => message.id === "__optimistic_matching"),
  false,
);
assert.equal(
  reconciledMessages.some((message) => message.id === "__optimistic_unmatched"),
  true,
);

const switchedSwipe = reconcilePersistedMessages(
  {
    pageParams: [undefined],
    pages: [
      [
        {
          id: "assistant-with-illustration",
          chatId: "chat-reconciliation-proof",
          role: "assistant",
          characterId: "character-1",
          content: "Previous swipe",
          activeSwipeIndex: 0,
          createdAt: "2026-08-14T12:02:30.000Z",
          extra: { attachments: [{ type: "image", url: "/previous-swipe.png" }] },
        },
      ],
    ],
  },
  [
    {
      id: "assistant-with-illustration",
      chatId: "chat-reconciliation-proof",
      role: "assistant",
      characterId: "character-1",
      content: "New swipe",
      activeSwipeIndex: 1,
      createdAt: "2026-08-14T12:02:30.000Z",
      extra: { generationInfo: { model: "new-swipe-model" } },
    },
  ],
).pages.flat()[0];
assert.deepEqual(
  switchedSwipe?.extra,
  { generationInfo: { model: "new-swipe-model" } },
  "A saved replacement swipe must not inherit illustration attachments from the previously active swipe",
);
const refreshedSameSwipe = reconcilePersistedMessages(
  {
    pageParams: [undefined],
    pages: [[{ ...switchedSwipe!, extra: { attachments: [{ type: "image", url: "/current-swipe.png" }] } }]],
  },
  [{ ...switchedSwipe!, extra: { generationInfo: { model: "new-swipe-model" } } }],
).pages.flat()[0];
assert.deepEqual(
  refreshedSameSwipe?.extra,
  {
    attachments: [{ type: "image", url: "/current-swipe.png" }],
    generationInfo: { model: "new-swipe-model" },
  },
  "A same-swipe refresh must retain post-processing attachments that arrived after its saved snapshot",
);

const duplicateIncoming: Parameters<typeof reconcilePersistedMessages>[1] = [
  {
    id: "durable-duplicate",
    chatId: "chat-reconciliation-proof",
    role: "assistant",
    characterId: "character-1",
    content: "Earlier duplicate content",
    activeSwipeIndex: 0,
    createdAt: "2026-08-14T12:03:00.000Z",
    extra: {},
  },
  {
    id: "durable-between",
    chatId: "chat-reconciliation-proof",
    role: "assistant",
    characterId: "character-1",
    content: "Between duplicate snapshots",
    activeSwipeIndex: 0,
    createdAt: "2026-08-14T12:04:00.000Z",
    extra: {},
  },
  {
    id: "durable-duplicate",
    chatId: "chat-reconciliation-proof",
    role: "assistant",
    characterId: "character-1",
    content: "Latest duplicate content",
    activeSwipeIndex: 0,
    createdAt: "2026-08-14T12:03:00.000Z",
    extra: {},
  },
];
for (const old of [undefined, { pageParams: [undefined], pages: [[]] }]) {
  const deduped = reconcilePersistedMessages(old, duplicateIncoming).pages.flat();
  assert.deepEqual(
    deduped.map((message) => message.id),
    ["durable-duplicate", "durable-between"],
    "Duplicate durable IDs must collapse without changing their first incoming position",
  );
  assert.equal(
    deduped[0]?.content,
    "Latest duplicate content",
    "The latest snapshot for a duplicate durable ID must supply its reconciled value",
  );
}

const confirmDurableSubmittedUserTurnSource =
  /const confirmDurableSubmittedUserTurn = async \(\) => \{[\s\S]*?\n      \};/u.exec(useGenerateSource)?.[0];
assert.ok(confirmDurableSubmittedUserTurnSource, "The failed-generation recovery helper must remain available");
assert.match(confirmDurableSubmittedUserTurnSource, /upsertPersistedMessages\(qc, params\.chatId, messages\)/u);
assert.match(useGenerateSource, /return await confirmDurableSubmittedUserTurn\(\)/u);
const chatInputSource = readSourceText(
  new URL("../../packages/client/src/components/chat/ChatInput.tsx", import.meta.url),
  "utf8",
);
const chatMessageSource = readSourceText(
  new URL("../../packages/client/src/components/chat/ChatMessage.tsx", import.meta.url),
  "utf8",
);
const chatRoleplaySurfaceSource = readSourceText(
  new URL("../../packages/client/src/components/chat/ChatRoleplaySurface.tsx", import.meta.url),
  "utf8",
);
const pageActivitySource = readSourceText(
  new URL("../../packages/client/src/hooks/use-page-activity.ts", import.meta.url),
  "utf8",
);
const appShellSource = readSourceText(
  new URL("../../packages/client/src/components/layout/AppShell.tsx", import.meta.url),
  "utf8",
);
const appSource = readSourceText(new URL("../../packages/client/src/App.tsx", import.meta.url), "utf8");
const peekPromptModalSource = readSourceText(
  new URL("../../packages/client/src/components/chat/PeekPromptModal.tsx", import.meta.url),
  "utf8",
);
const chatAreaSource = readSourceText(
  new URL("../../packages/client/src/components/chat/ChatArea.tsx", import.meta.url),
  "utf8",
);
const generateHookSource = readSourceText(
  new URL("../../packages/client/src/hooks/use-generate.ts", import.meta.url),
  "utf8",
);
const weatherEffectsSource = readSourceText(
  new URL("../../packages/client/src/components/chat/WeatherEffects.tsx", import.meta.url),
  "utf8",
);
const weatherWorkerSource = readSourceText(
  new URL("../../packages/client/src/workers/weather-effects.worker.ts", import.meta.url),
  "utf8",
);
const gameSurfaceSource = readSourceText(
  new URL("../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
const echoChamberPanelSource = readSourceText(
  new URL("../../packages/client/src/components/chat/EchoChamberPanel.tsx", import.meta.url),
  "utf8",
);
const uiStoreSource = readSourceText(new URL("../../packages/client/src/stores/ui.store.ts", import.meta.url), "utf8");
const globalStylesSource = readSourceText(
  new URL("../../packages/client/src/styles/globals.css", import.meta.url),
  "utf8",
);
const firefoxSupportsSource = extractCssBlock(globalStylesSource, "@supports (-moz-appearance: none)");
const conversationInputSource = readSourceText(
  new URL("../../packages/client/src/components/chat/ConversationInput.tsx", import.meta.url),
  "utf8",
);
const presetEditorSource = readSourceText(
  new URL("../../packages/client/src/components/presets/PresetEditor.tsx", import.meta.url),
  "utf8",
);
const useChatsSource = readSourceText(new URL("../../packages/client/src/hooks/use-chats.ts", import.meta.url), "utf8");
const gameInputSource = readSourceText(
  new URL("../../packages/client/src/components/game/GameInput.tsx", import.meta.url),
  "utf8",
);
const chatStoreSource = readSourceText(
  new URL("../../packages/client/src/stores/chat.store.ts", import.meta.url),
  "utf8",
);
const summaryPopoverSource = readSourceText(
  new URL("../../packages/client/src/components/chat/SummaryPopover.tsx", import.meta.url),
  "utf8",
);
const professorMariHomeSource = readSourceText(
  new URL("../../packages/client/src/components/chat/HomeProfessorMariChat.tsx", import.meta.url),
  "utf8",
);
const personalExtensionsHookSource = readSourceText(
  new URL("../../packages/client/src/hooks/use-personal-extensions.ts", import.meta.url),
  "utf8",
);
const chatSettingsDrawerSource = readSourceText(
  new URL("../../packages/client/src/components/chat/ChatSettingsDrawer.tsx", import.meta.url),
  "utf8",
);
const reducedAmbientEffectsHookSource = readSourceText(
  new URL("../../packages/client/src/hooks/use-reduced-ambient-effects.ts", import.meta.url),
  "utf8",
);
const professorMariTokenBranch =
  professorMariHomeSource.match(/if \(event\.type === "token"[\s\S]*?continue;/u)?.[0] ?? "";
const roleplayTrackerSettingsBranch =
  chatSettingsDrawerSource.match(
    /activeInCat\.map\(\(agent\) => \{[\s\S]*?\{\/\* Available agents to add \*\//u,
  )?.[0] ?? "";
assert.match(professorMariHomeSource, /rafThrottle<void>\(appendPendingWorkspaceText\)/u);
assert.doesNotMatch(professorMariTokenBranch, /setWorkspaceTimeline/u);
assert.match(professorMariHomeSource, /void refreshAfterWorkspaceRun\(chat\.id, runId\)/u);
assert.match(professorMariHomeSource, /WORKSPACE_SETTLE_REQUEST_TIMEOUT_MS/u);
assert.doesNotMatch(personalExtensionsHookSource, /refetchInterval/u);
assert.match(chatSettingsDrawerSource, /active && agent\.id !== "illustrator"[\s\S]*?<AgentPromptTemplateSelect/u);
assert.match(
  roleplayTrackerSettingsBranch,
  /cat\.key === "tracker"[\s\S]*?<AgentPromptTemplateSelect/u,
  "active Roleplay tracker agents should expose their saved prompt templates",
);
assert.match(reducedAmbientEffectsHookSource, /manualPreference \|\| systemPreference/u);
assert.match(uiStoreSource, /version: 96/u);
assert.match(globalStylesSource, /data-marinara-reduced-effects/u);
const accentTransitionStyles =
  globalStylesSource.match(
    /\[data-marinara-accent-animation\][\s\S]*?:where\([\s\S]*?\.mari-topbar-button[\s\S]*?\)\s*\{([\s\S]*?)\}/u,
  )?.[1] ?? "";
assert.match(accentTransitionStyles, /opacity 180ms linear/u);
assert.match(accentTransitionStyles, /transform 180ms linear/u);
assert.doesNotMatch(
  accentTransitionStyles,
  /background-color|border-color|\bcolor\s+180ms|\bstroke\s+180ms/u,
  "root accent ticks must not start color transitions throughout the mounted UI",
);
assert.doesNotMatch(
  appSource,
  /applyCursorAccent\(liveAccent/u,
  "animated accent ticks must not force synchronous custom-cursor color resolution",
);
const roleplayLiveStreamSource =
  chatRoleplaySurfaceSource.match(/function RoleplayLiveStreamText[\s\S]*?\nfunction StreamingIndicator/u)?.[0] ?? "";
assert.match(
  roleplayLiveStreamSource,
  /function RoleplayLiveStreamText[\s\S]*?setText\(next\)[\s\S]*?requestAnimationFrame\(apply\)/u,
  "Roleplay live formatting should update at animation-frame cadence",
);
assert.match(
  chatRoleplaySurfaceSource,
  /const hasVisibleStreamText = \(text: string\) => \/\\S\/u\.test\(text\);[\s\S]*?hasVisibleStreamText\(s\.streamBuffers\.get\(activeChatId\)/u,
  "Whitespace-only stream chunks must not collapse inline reasoning",
);
assert.match(
  chatRoleplaySurfaceSource,
  /\{!centerCompact && \(\s*<div\s*data-tracker-panel-anchor="roleplay-hud"/u,
  "The expanded Roleplay toolbar must not render alongside its compact replacement",
);
assert.doesNotMatch(
  roleplayLiveStreamSource,
  /replaceChildren|textContent\s*=/u,
  "Roleplay streaming should let React reconcile formatted output instead of mutating the DOM directly",
);
assert.match(
  chatMessageSource,
  /streamingContent\(renderStreamingText\)/u,
  "Roleplay streaming must reuse the committed-message formatter",
);
assert.doesNotMatch(
  chatRoleplaySurfaceSource,
  /useThrottledStreamBuffer/u,
  "Roleplay streaming should not rebuild ChatMessage from the growing buffer",
);
assert.doesNotMatch(pageActivitySource, /document\.hasFocus|addEventListener\(\s*["'](?:blur|focus)["']/u);
assert.match(pageActivitySource, /document\.visibilityState === "visible"/u);
const activeContextLinksButtonSource =
  chatRoleplaySurfaceSource.match(/function ActiveContextLinksButton[\s\S]*?\nfunction SummaryButton/u)?.[0] ?? "";
assert.match(
  summaryPopoverSource,
  /className="fixed z-\[9999\]"[\s\S]*?return createPortal\(content, document\.body\)/u,
  "the Roleplay Chat Summary panel should portal above independent floating-panel stacking contexts",
);
assert.match(
  activeContextLinksButtonSource,
  /desktopAnchor &&[\s\S]*?createPortal\([\s\S]*?data-component="RoleplayActiveContextPanel"[\s\S]*?fixed z-\[9999\][\s\S]*?document\.body/u,
  "the desktop Roleplay Active Context panel should portal above independent floating-panel stacking contexts",
);
assert.doesNotMatch(
  activeContextLinksButtonSource,
  /absolute right-0 top-full/u,
  "the desktop Roleplay Active Context panel must not remain trapped in the toolbar stacking context",
);
const spatialTransitionEventSource =
  useGenerateSource.match(/case "spatial_transition_committed": \{[\s\S]*?case "token":/u)?.[0] ?? "";
assert.match(
  spatialTransitionEventSource,
  /dispatchSpatialCapabilityEvent\(getGameExperiencePackageId\(qc, params\.chatId\), \{[\s\S]*?type: event\.type,[\s\S]*?chatId: params\.chatId,[\s\S]*?data: event\.data,[\s\S]*?\}\)/u,
  "the spatial transition SSE should immediately notify the downloaded Maps client cache and the owning Experience",
);
assert.match(
  spatialTransitionEventSource,
  /invalidateQueries\(\{ queryKey: spatialContextKeys\.detail\(params\.chatId\) \}\)/u,
  "the spatial transition SSE should immediately refresh the Engine spatial cache",
);
const generationCleanupSource =
  useGenerateSource.match(/\/\/ Stream has terminated[\s\S]*?const completedReply =/u)?.[0] ?? "";
const missedSpatialRefreshBlock =
  generationCleanupSource.match(
    /if \(\s*\(chatModeForGeneration === "roleplay" \|\| chatModeForGeneration === "game"\) &&\s*!spatialCapabilityRefreshDispatched\s*\) \{[\s\S]*?\n        \}/u,
  )?.[0] ?? "";
assert.notEqual(missedSpatialRefreshBlock, "", "generation cleanup should contain the missed spatial refresh block");
assert.match(
  missedSpatialRefreshBlock,
  /dispatchSpatialCapabilityEvent\(getGameExperiencePackageId\(qc, params\.chatId\), \{[\s\S]*?type: "spatial_context_refresh",[\s\S]*?chatId: params\.chatId,[\s\S]*?data: null,[\s\S]*?\}\)/u,
  "missed spatial transition cleanup should notify the downloaded Maps client cache and the owning Experience",
);
assert.match(
  missedSpatialRefreshBlock,
  /void qc\.invalidateQueries\(\{[\s\S]*?queryKey: spatialContextKeys\.detail\(params\.chatId\),[\s\S]*?exact: true,[\s\S]*?refetchType: "active",[\s\S]*?\}\)/u,
  "missed spatial transition cleanup should refresh the Engine spatial cache without blocking teardown",
);
const ownerCleanupBlock =
  generationCleanupSource.match(/if \(stillOwnerAtCleanupStart\) \{[\s\S]*?\n        \}/u)?.[0] ?? "";
assert.match(
  ownerCleanupBlock,
  /clearPerChatState\(params\.chatId\)/u,
  "the generation owner should clear per-chat state after spatial reconciliation is dispatched",
);
assert.ok(
  generationCleanupSource.indexOf(missedSpatialRefreshBlock) < generationCleanupSource.indexOf(ownerCleanupBlock),
  "spatial reconciliation should be dispatched before generation-owner cleanup",
);
const capabilityClientEventsSource = readSourceText(
  new URL("../../packages/client/src/lib/capability-client-events.ts", import.meta.url),
  "utf8",
);
assert.match(
  capabilityClientEventsSource,
  /dispatchCapabilityClientEvent\(\{ packageId: "hierarchical-maps", \.\.\.detail \}\);\s*if \(experiencePackageId\) dispatchCapabilityClientEvent\(\{ packageId: experiencePackageId, \.\.\.detail \}\);/u,
  "spatial capability events must dual-dispatch to World Maps and the game-owning Experience (capability API 1.12)",
);
assert.match(
  useGenerateSource,
  /setPendingSpatialTransitionStatus\(params\.chatId, "needs_review"\);[\s\S]{0,1400}?dispatchSpatialCapabilityEvent\(getGameExperiencePackageId\(qc, params\.chatId\), \{[\s\S]{0,200}?type: "spatial_transition_rejected",/u,
  "an HTTP-rejected owner-turn transition must synthesize spatial_transition_rejected to BOTH audiences",
);
assert.match(
  useGenerateSource,
  /spatialErrorCode\?\.startsWith\("spatial_"\) && spatialErrorCode !== "spatial_transition_already_applied"/u,
  "the synthesized reject must fire only on definitive evidence — never for already_applied or codeless failures",
);
const useSpatialContextSource = readSourceText(
  new URL("../../packages/client/src/hooks/use-spatial-context.ts", import.meta.url),
  "utf8",
);
assert.match(
  useSpatialContextSource,
  /rejectCode !== "spatial_transition_already_applied";[\s\S]{0,700}?dispatchSpatialCapabilityEvent\(getGameExperiencePackageId\(queryClient, variables\.chatId\), \{[\s\S]{0,200}?type: "spatial_transition_rejected",/u,
  "the REST owner-turn commit must synthesize its reject to BOTH audiences, gated on definitive evidence",
);
assert.match(
  useSpatialContextSource,
  /type: "spatial_context_refresh",[\s\S]{0,120}?chatId: variables\.chatId,/u,
  "inconclusive REST commit failures must fall back to the untyped refresh nudge",
);
assert.match(
  useGenerateSource,
  /STREAM_TYPEWRITER_PREBUFFER_MS = 320/u,
  "visible streaming should build a short initial reserve before starting its continuous reveal",
);
assert.match(
  useGenerateSource,
  /smoothRoleplayTypewriter = chatModeForGeneration === "roleplay"/u,
  "queue-aware smoothing should remain scoped to Roleplay mode",
);
assert.match(
  useGenerateSource,
  /getRoleplayTypewriterRevealCharsPerSecond\(\{[\s\S]*?pendingCharacters: pendingText\.length/u,
  "Roleplay streaming should preserve a reserve between provider bursts",
);
assert.match(
  chatRoleplaySurfaceSource,
  /WeatherEffectsConnected paused=\{weatherEffectsPaused\}/u,
  "weather effects should keep animating while tracker agents generate",
);
assert.doesNotMatch(
  chatRoleplaySurfaceSource,
  /WeatherEffectsConnected paused=\{ambientVisualsPaused\}/u,
  "tracker generation must not pause the last rendered weather effect",
);
assert.match(
  echoChamberPanelSource,
  /const FLOATING_EDGE_GAP = 16;/u,
  "Echo Chamber should leave the native Roleplay scrollbar reachable",
);
assert.match(
  echoChamberPanelSource,
  /\.\.\.\(!isLeft && \{ right: FLOATING_EDGE_GAP \}\)/u,
  "Echo Chamber should keep a fixed clearance from the right edge",
);
assert.match(
  appShellSource,
  /right: rightPanelOpen \? liveRightPanelWidth : 0/u,
  "the right-side Trackers Panel should stay outside the open settings panel",
);
assert.doesNotMatch(
  peekPromptModalSource.match(/<div\s+className="fixed inset-0 z-\[100\][^\n]*/u)?.[0] ?? "",
  /backdrop-blur/u,
  "Peek Prompt must not continuously repaint the animated scene through a full-screen backdrop filter",
);
const illustratorCadencePersistenceIndex = generateRouteSource.indexOf(
  "Persist the agent decision before any background image work",
);
assert.notEqual(illustratorCadencePersistenceIndex, -1, "agent cadence decisions should be persisted eagerly");
assert.ok(
  illustratorCadencePersistenceIndex <
    generateRouteSource.indexOf("pendingIllustration =", illustratorCadencePersistenceIndex),
  "Illustrator cadence must be persisted before background image generation begins",
);
assert.match(
  generateRouteSource,
  /const runCheckpoint = \{[\s\S]{0,180}runId: newId\(\)[\s\S]{0,700}agentsStore\.saveRun\(runCheckpoint\)[\s\S]{0,500}Failed to persist cadence checkpoint after retry[\s\S]{0,80}throw retryError/u,
  "Illustrator cadence persistence should retry idempotently and fail closed when its checkpoint cannot be saved",
);
assert.match(
  echoChamberPanelSource,
  /activeChatId \? \(s\.echoChamberSizeByChatId\[activeChatId\] \?\? null\) : null/u,
  "Echo Chamber should restore the dimensions remembered for the active chat",
);
assert.match(
  echoChamberPanelSource,
  /if \(activeChatId\) setEchoChamberSizeForChat\(activeChatId, nextSize\);/u,
  "Echo Chamber should persist a completed resize against the active chat",
);
assert.match(
  echoChamberPanelSource,
  /onPointerCancel=\{handleResizeCancel\}/u,
  "a canceled Echo Chamber resize should use its rollback path",
);
assert.match(
  echoChamberPanelSource,
  /onLostPointerCapture=\{handleResizeLostCapture\}/u,
  "Echo Chamber should still commit a finished drag when the browser drops pointer capture",
);
assert.doesNotMatch(
  echoChamberPanelSource,
  /onPointerCancel=\{handleResizeEnd\}/u,
  "pointer cancellation must not persist an incomplete Echo Chamber resize",
);
assert.match(
  uiStoreSource,
  /echoChamberSizeByChatId: state\.echoChamberSizeByChatId/u,
  "per-chat Echo Chamber dimensions should survive UI-store rehydration",
);
assert.match(
  uiStoreSource,
  /previous\.echoChamberSizes !== next\.echoChamberSizes/u,
  "an Echo Chamber size change should bypass the debounced UI storage write",
);
assert.match(
  uiStoreSource,
  /if \(shouldFlushUiStorageImmediately\(previousValue, value\)\) \{\s+flush\(\);/u,
  "critical UI preferences should flush synchronously before the app can close",
);
assert.match(
  summaryPopoverSource,
  /const \[draft, setDraft\] = useState\(\(\) => \(\{ \.\.\.entry \}\)\);/u,
  "summary typing should update editor-local state instead of rerendering the entire popover",
);
assert.doesNotMatch(
  summaryPopoverSource,
  /onDraftChange=\{setDraftEntry\}/u,
  "summary keystrokes must not update popover-level draft state",
);
assert.equal(
  shouldFormatTextareaQuotes({ inputType: "insertText", data: '"', isComposing: false } as InputEvent, 'She said "'),
  true,
  "direct quote insertion should retain immediate quote formatting",
);
assert.equal(
  shouldFormatTextareaQuotes(
    { inputType: "insertCompositionText", data: '"', isComposing: true } as InputEvent,
    'She said "',
  ),
  false,
  "IME composition must not rewrite the textarea value beneath the mobile keyboard",
);
assert.equal(
  shouldFormatTextareaQuotes(
    { inputType: "insertReplacementText", data: null, isComposing: false } as InputEvent,
    'She said "hello" and kept typing',
  ),
  false,
  "autocorrect replacements with null data must not rescan and rewrite the full draft",
);
assert.equal(
  shouldFormatTextareaQuotes(
    { inputType: "deleteContentBackward", data: null, isComposing: false } as InputEvent,
    'She said "hello',
  ),
  false,
  "deletion must remain a mutation-free fast path",
);
assert.equal(
  shouldFormatTextareaQuotes(
    { inputType: "insertFromPaste", data: null, isComposing: false } as InputEvent,
    'Pasted "dialogue"',
  ),
  true,
  "pasted dialogue should still be formatted once",
);
assert.match(
  presetEditorSource,
  /function SectionContentTextarea\([\s\S]{0,1400}const handleChange = \(nextRawValue: string\) => \{\s+const nextValue = nextRawValue;/u,
  "preset section editors should commit the event-aware MacroTextarea value without reformatting the full draft",
);
assert.match(
  chatStoreSource,
  /api\.post\("\/generate\/abort", \{ chatId \}\)/u,
  "explicit stop requests must use the authenticated API client so CSRF protection cannot discard them",
);
assert.doesNotMatch(
  chatStoreSource,
  /fetch\("\/api\/generate\/abort"/u,
  "generation abort must not bypass shared CSRF and admin-auth headers",
);
const originalFetch = globalThis.fetch;
let capturedAbortRequest: { input: string | URL | Request; init?: RequestInit } | null = null;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  capturedAbortRequest = { input, init };
  return new Response(JSON.stringify({ aborted: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) as typeof fetch;
try {
  await api.post("/generate/abort", { chatId: "roleplay-stop-regression" });
} finally {
  globalThis.fetch = originalFetch;
}
assert.ok(capturedAbortRequest, "the shared API client should send an abort request");
assert.equal(String(capturedAbortRequest.input), "/api/generate/abort");
assert.equal(new Headers(capturedAbortRequest.init?.headers).get(CSRF_HEADER), CSRF_HEADER_VALUE);

class VisibilityDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  setVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

function sseFrame(type: string, data: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ type, data })}\n\n`);
}

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const visibilityDocument = new VisibilityDocument();
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: visibilityDocument,
});

let healthyStreamController: ReadableStreamDefaultController<Uint8Array> | null = null;
globalThis.fetch = (async () =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        healthyStreamController = controller;
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  )) as typeof fetch;
try {
  const events = api.streamEvents("/generate", {}, undefined, {
    disconnectOnResume: true,
    resumeDisconnectGraceMs: 50,
  });
  const firstEvent = events.next();
  healthyStreamController!.enqueue(sseFrame("token", "First"));
  assert.deepEqual(await firstEvent, { done: false, value: { type: "token", data: "First" } });

  const resumedEvent = events.next();
  visibilityDocument.setVisibility("hidden");
  visibilityDocument.setVisibility("visible");
  await new Promise((resolve) => setTimeout(resolve, 10));
  healthyStreamController!.enqueue(sseFrame("token", " second"));
  assert.deepEqual(
    await resumedEvent,
    { done: false, value: { type: "token", data: " second" } },
    "a healthy stream must survive tab resume instead of being replaced by the persisted full reply",
  );
  healthyStreamController!.close();
  assert.equal((await events.next()).done, true);

  let stalledStreamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          stalledStreamController = controller;
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      },
    )) as typeof fetch;
  const stalledEvents = api.streamEvents("/generate", {}, undefined, {
    disconnectOnResume: true,
    resumeDisconnectGraceMs: 5,
  });
  const initialStalledEvent = stalledEvents.next();
  stalledStreamController!.enqueue(sseFrame("token", "Before hiding"));
  assert.deepEqual(await initialStalledEvent, {
    done: false,
    value: { type: "token", data: "Before hiding" },
  });
  const stalledRead = stalledEvents.next();
  await assert.rejects(stalledRead, StreamResumeDisconnectError);
} finally {
  globalThis.fetch = originalFetch;
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
}
assert.match(
  generateRouteSource,
  /type: "illustration_queued"/u,
  "automatic Illustrator runs should announce their background-only tail before generation completes",
);
assert.match(
  retryAgentRouteSource,
  /type: "illustration_queued"/u,
  "an Illustrator-only retry should expose the same background handoff",
);
assert.match(
  generateHookSource,
  /const isIllustratorOnlyRetry =[\s\S]{0,180}agentTypes\.every\(\(agentType\) => agentType === "illustrator"\)/u,
  "retry handoff should identify Illustrator-only work without exempting mixed agent retries",
);
assert.match(
  generateHookSource,
  /case "illustration_queued": \{[\s\S]{0,180}if \(isIllustratorOnlyRetry\) \{[\s\S]{0,120}setBackgroundIllustration\(chatId, true\);/u,
  "only an Illustrator-only retry should hand off from text streaming to background image work",
);
assert.match(
  generateHookSource,
  /const submittedUserTurn = hasVisibleUserMessagePayload\(params\.userMessage, pendingAttachments\);/u,
  "generation should remember whether the stopped request submitted visible text or attachments",
);
assert.equal(
  generateHookSource.match(/submittedUserTurn \|\| receivedContent \|\| spatialTransitionCommitted/gu)?.length,
  2,
  "stopping a submitted user turn should remain successful even before assistant content arrives",
);
assert.match(
  chatAreaSource,
  /const isTextStreaming = isStreaming && !isBackgroundIllustration;/u,
  "finished assistant text must stop being treated as streaming while Illustrator continues",
);
assert.match(
  chatAreaSource,
  /isStreaming=\{isTextStreaming\}[\s\S]{0,120}generationVisualsPaused=\{isStreaming \|\| agentProcessing\}/u,
  "Roleplay messages should remain editable while ambient rendering stays suspended for background work",
);
const earlyTTSReadyIndex = generateRouteSource.indexOf("if (activatedTextRewriteRunAgents.length === 0)");
const parallelAgentWaitIndex = generateRouteSource.indexOf("const completedParallelResults = await parallelPromise");
const textRewritePhaseIndex = generateRouteSource.indexOf("// ── Text rewrite/editing agents:");
const rewrittenTTSReadyIndex = generateRouteSource.indexOf("if (activatedTextRewriteRunAgents.length > 0)");
assert.ok(
  earlyTTSReadyIndex > 0 && earlyTTSReadyIndex < parallelAgentWaitIndex,
  "TTS-ready text without a rewrite agent must be released before parallel and post-generation agents finish",
);
assert.ok(
  rewrittenTTSReadyIndex > textRewritePhaseIndex,
  "TTS-ready text must wait for active message-rewriting agents to persist their final edit",
);
assert.match(
  generateRouteSource,
  /activatedTextRewriteRunAgents\.length === 0\) \{\s*await sendAssistantMessageReady\(currentIterationSavedMsg\)/u,
  "TTS-ready text without a rewrite agent should use the saved row without another storage lookup",
);
assert.match(
  generateRouteSource,
  /activatedTextRewriteRunAgents\.length > 0\) \{\s*await sendAssistantMessageReady\(\)/u,
  "TTS-ready text after rewrite agents must reload the persisted edited row",
);
assert.match(
  generateRouteSource,
  /while \(true\) \{[\s\S]{0,700}let currentIterationSavedMsg: typeof lastSavedMsg = null/u,
  "Each Mari follow-up iteration must reset the assistant message eligible for TTS",
);
assert.match(
  generateRouteSource,
  /const messageId = \(currentIterationSavedMsg as \{ id\?: unknown \} \| null\)\?\.id/u,
  "TTS readiness must use only the assistant message saved in the current follow-up iteration",
);
assert.match(
  generateHookSource,
  /case "assistant_message_ready": \{[\s\S]{0,500}TTS_AUTOPLAY_MESSAGE_READY_EVENT/u,
  "the generation stream must forward finalized assistant text to TTS autoplay immediately",
);
assert.match(
  chatAreaSource,
  /addEventListener\(TTS_AUTOPLAY_MESSAGE_READY_EVENT, handleMessageReady\)/u,
  "TTS autoplay must listen for finalized text without waiting for the full agent stream to close",
);
const galleryCreateIndex = generateRouteSource.indexOf("const galleryEntry = await galleryStore.create");
const illustrationMessageLookupIndex = generateRouteSource.indexOf(
  "const msgRow = await chats.getMessage(messageId)",
  galleryCreateIndex,
);
assert.notEqual(galleryCreateIndex, -1, "Illustrator must persist generated images to Gallery");
assert.ok(
  illustrationMessageLookupIndex > galleryCreateIndex,
  "Illustrator must save to Gallery before checking whether the source message still exists",
);
const chatTextareaSource = chatInputSource.match(/<textarea[\s\S]*?\/>/u)?.[0] ?? "";
const chatHandleInputSource =
  chatInputSource.match(
    /const handleInput = \(event\?: FormEvent<HTMLTextAreaElement>\) => \{[\s\S]*?\n  \};\n\n  \/\/ Dismiss feedback/u,
  )?.[0] ?? "";
assert.match(chatTextareaSource, /disabled=\{!activeChatId\}/u);
assert.match(
  chatAreaSource,
  /target instanceof HTMLTextAreaElement[\s\S]{0,160}target\.dataset\.chatComposer === "true"[\s\S]{0,120}target\.value\.length === 0/u,
  "intuitive Left/Right navigation should exempt only an empty main chat composer",
);
assert.match(
  chatAreaSource,
  /event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey[\s\S]{0,180}allowEmptyMainComposer: true/u,
  "empty-composer swipe navigation should remain limited to unmodified arrow keys",
);
assert.match(chatTextareaSource, /data-chat-composer="true"/u, "Roleplay should identify its main composer");
assert.match(
  conversationInputSource,
  /ref=\{textareaRef\}\s+data-chat-composer="true"/u,
  "Conversation should identify its main composer",
);
assert.match(
  chatTextareaSource,
  /onInput=\{handleInput\}/u,
  "Roleplay should use the direct input event path used by Conversation",
);
assert.doesNotMatch(
  chatTextareaSource,
  /onChange=\{handleInput\}/u,
  "Roleplay typing should not route through React's normalized change event",
);
assert.doesNotMatch(
  chatTextareaSource,
  /disabled=\{[^}]*isInputBusy/u,
  "agent work should guard sending without disabling preparation of the next draft",
);
assert.match(
  chatHandleInputSource,
  /if \(!isDeleting\) \{[\s\S]*?scheduleTextareaFrameResize\(el\);[\s\S]*?\} else \{[\s\S]*?scheduleTextareaResize\([\s\S]*?ROLEPLAY_INPUT_DELETE_RESIZE_IDLE_MS/u,
  "Roleplay insertions should resize before paint while deletions retain their idle resize window",
);
assert.match(
  chatHandleInputSource,
  /if \(shouldDeferDeleteWork\) \{\s+heldDeleteResizeRef\.current = el;/u,
  "held Roleplay deletion should defer its layout read until the key is released",
);
assert.match(
  chatInputSource,
  /if \(e\.key === "Enter"\) \{[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?resizeChatInputTextarea\(el\);/u,
  "Roleplay line breaks should resize before paint so the existing draft does not briefly disappear",
);
assert.doesNotMatch(
  chatHandleInputSource,
  /requestAnimationFrame\(\(\) => \{[\s\S]*?resizeChatInputTextarea\(el\);/u,
  "Roleplay textarea resizing must not schedule a layout read for every ordinary keystroke",
);
assert.match(
  chatInputSource,
  /if \(hasInputRef\.current === nextHasInput\) return;[\s\S]*?setHasInput\(nextHasInput\);[\s\S]*?setCurrentInputPresence\(nextHasInput\);/u,
  "Roleplay composer presence should change only when the draft crosses the empty boundary",
);
assert.doesNotMatch(
  chatInputSource,
  /currentInputFrameRef/u,
  "Roleplay typing and deletion should not publish draft snapshots on an animation-frame cadence",
);
assert.match(
  chatInputSource,
  /updateCurrentInputSnapshot\(value\);/u,
  "Roleplay should update its raw guided-regeneration snapshot without notifying Zustand subscribers",
);
assert.match(
  chatMessageSource,
  /const isGuided = useChatStore\(\(state\) => guideGenerations && state\.hasCurrentInput\);/u,
  "Roleplay message actions should not subscribe to draft presence when guided regeneration is disabled",
);
assert.match(
  globalStylesSource,
  /\[data-chat-mode="roleplay"\] \.mari-chat-input-textarea \{\s+contain: paint;/u,
  "Roleplay textarea paint should stay isolated from the live scene behind it",
);
assert.match(
  firefoxSupportsSource,
  /\[data-chat-mode="roleplay"\] \.marinara-chat-input-shell\s*\{[^{}]*contain:\s*layout paint;[^{}]*isolation:\s*isolate;/u,
  "Firefox should contain composer layout and paint while text is edited",
);
assert.match(
  chatRoleplaySurfaceSource,
  /generationVisualsPaused \|\| \(isMobileToolbarViewport && \(keyboardOpen \|\| composerFocused \|\| hasMobileDraftInput\)\)/u,
  "Roleplay should pause ambient rendering while the mobile keyboard, composer, or draft is active",
);
assert.match(
  chatRoleplaySurfaceSource,
  /ambientVisualsPaused && "mari-generation-render-paused"/u,
  "Roleplay should reuse the ambient-render pause for mobile input and generation",
);
assert.match(
  chatRoleplaySurfaceSource,
  /const weatherEffectsPaused =\s+isMobileToolbarViewport && \(keyboardOpen \|\| composerFocused \|\| hasMobileDraftInput\)/u,
  "mobile text input should suspend Roleplay weather rendering instead of competing for device resources",
);
assert.match(
  gameSurfaceSource,
  /\(isStreaming \|\| scenePreparing \|\| sceneAnalysis\.isPending \|\| agentsProcessing\) &&[\s\S]{0,80}"mari-generation-render-paused"/u,
  "Game should pause ambient rendering during GM, scene-model, and agent generation",
);
assert.match(
  gameSurfaceSource,
  /paused=\{isStreaming \|\| scenePreparing \|\| sceneAnalysis\.isPending \|\| agentsProcessing\}/u,
  "Game weather should remain paused through background agent work",
);
assert.match(
  weatherEffectsSource,
  /workerRef\.current\?\.postMessage\(\{ type: "visibility", hidden: document\.hidden \|\| paused \}\)/u,
  "weather workers should receive generation suspension state",
);
assert.match(
  weatherEffectsSource,
  /if \(document\.hidden \|\| pausedRef\.current\) \{[\s\S]{0,180}frameRef\.current = 0;/u,
  "fallback weather rendering should stop scheduling frames while suspended",
);
assert.match(
  weatherWorkerSource,
  /function setSuspended\(suspended: boolean\)[\s\S]{0,220}clearTimeout\(timer\);[\s\S]{0,120}scheduleFrame\(\);/u,
  "offscreen weather rendering should stop its timer rather than polling while suspended",
);
assert.match(
  globalStylesSource,
  /\.mari-generation-render-paused[\s\S]{0,500}animation-play-state: paused !important;/u,
  "decorative CSS animations should yield GPU time during generation",
);
assert.match(
  firefoxSupportsSource,
  /(?:^|\})[^{}]*\[data-chat-mode="roleplay"\] \.marinara-chat-input-shell\s*\{[^{}]*backdrop-filter:\s*none !important;[^{}]*\}/u,
  "Firefox should not repaint the Roleplay scene through a blurred composer while typing",
);
assert.match(
  firefoxSupportsSource,
  /(?:^|\})\s*\[data-chat-mode="roleplay"\] \.marinara-chat-input-shell\s*\{[^{}]*background:\s*linear-gradient\(var\(--card\), var\(--card\)\),\s*var\(--background\) !important;[^{}]*\}/u,
  "Firefox should use an opaque Roleplay composer surface after disabling backdrop blur",
);
assert.doesNotMatch(
  chatInputSource,
  /inputPresenceTimerRef/u,
  "Roleplay typing should not create and cancel a redundant presence timer on every keystroke",
);
assert.match(
  chatStoreSource,
  /currentInputPresenceTimer = setTimeout\(\(\) => \{[\s\S]*?\}, CURRENT_INPUT_PRESENCE_IDLE_MS\);/u,
  "draft presence should update transcript controls only after the input idle boundary",
);
assert.match(
  chatStoreSource,
  /setCurrentInputPresence: \(hasInput\) => \{[\s\S]*?state\.hasCurrentInput === hasInput/u,
  "ordinary draft characters should not notify mounted chat-store subscribers",
);
assert.match(
  chatStoreSource,
  /export function getCurrentInputSnapshot\(\): string/u,
  "guided regeneration should read the exact draft without subscribing the UI to every character",
);
assert.match(
  chatStoreSource,
  /export function updateCurrentInputSnapshot\(text: string\): void \{[\s\S]*?currentInputSnapshot = text;/u,
  "Roleplay input should publish its exact draft through the non-reactive snapshot path",
);
assert.doesNotMatch(
  chatRoleplaySurfaceSource,
  /hasDraftInput=\{hasDraftInput\}/u,
  "Roleplay draft presence should not rerender every heavyweight transcript message",
);
assert.doesNotMatch(
  chatRoleplaySurfaceSource,
  /setChromeHeights/u,
  "Roleplay composer growth should not rerender the heavyweight transcript through React state",
);
assert.match(
  chatRoleplaySurfaceSource,
  /scrollElement\.style\.setProperty\("--mari-roleplay-content-padding-bottom"/u,
  "Roleplay composer growth should update the transcript inset directly",
);
assert.match(
  chatRoleplaySurfaceSource,
  /paddingBottom: "var\(--mari-roleplay-content-padding-bottom, 16px\)"/u,
  "Roleplay transcript padding should consume the imperatively measured composer inset",
);
assert.match(
  chatMessageSource,
  /const GuidedRegenerateActionBtn = memo[\s\S]*?state\.hasCurrentInput/u,
  "only the guided Regenerate control should react to draft presence",
);
const conversationTextareaSource = conversationInputSource.match(/<textarea[\s\S]*?\/>/u)?.[0] ?? "";
assert.doesNotMatch(
  conversationTextareaSource,
  /disabled=/u,
  "Conversation drafts should remain editable regardless of send-blocking state",
);
const gameTextareaSource = gameInputSource.match(/<textarea[\s\S]*?\/>/u)?.[0] ?? "";
assert.match(
  gameTextareaSource,
  /disabled=\{draftDisabled\}/u,
  "Game mode should keep its draft field separate from the generation send lock",
);

assert.equal(
  isGenerationSendBlocked({ streamActive: true, agentsProcessing: true, backgroundIllustration: false }),
  true,
  "ordinary streaming and agent work should keep send actions guarded",
);
assert.equal(
  isGenerationSendBlocked({ streamActive: false, agentsProcessing: true, backgroundIllustration: false }),
  true,
  "agent-only retries should guard sending without locking the draft field",
);
assert.equal(
  isGenerationSendBlocked({ streamActive: true, agentsProcessing: true, backgroundIllustration: true }),
  false,
  "an Illustrator-only tail should permit the next message to be sent",
);
assert.equal(
  isGenerationSendBlocked({
    streamActive: true,
    agentsProcessing: true,
    backgroundIllustration: false,
    delayedResponse: true,
  }),
  false,
  "a Conversation presence delay should allow additional user messages to be posted",
);
assert.match(
  conversationInputSource,
  /const createDurableMessageWithRollback = useCallback\([\s\S]*?createMessage\.mutateAsync\(\{[\s\S]*?role: "user"/u,
  "the shared durable-message helper should persist user messages before attaching files",
);
assert.match(
  conversationInputSource,
  /if \(delayedCharacterInfo\) \{[\s\S]*?createDurableMessageWithRollback\(\{[\s\S]*?return;/u,
  "additional messages sent during a Conversation presence delay should persist without starting another generator",
);
assert.equal(
  isGenerationStartBlocked({ activeController: true, backgroundIllustration: false }),
  true,
  "ordinary same-chat generations must remain exclusive",
);
assert.equal(
  isGenerationStartBlocked({ activeController: true, backgroundIllustration: true }),
  false,
  "the next same-chat generation should be allowed while Illustrator finishes",
);
assert.match(
  retryAgentRouteSource,
  /const updateRetryTargetGameStateSnapshot = async/,
  "tracker retries should have an unanchored snapshot persistence path",
);
for (const resultType of [
  "game_state_update",
  "character_tracker_update",
  "persona_stats_update",
  "quest_update",
  "custom_tracker_update",
]) {
  assert.doesNotMatch(
    retryAgentRouteSource,
    new RegExp(`retryMessageId\\s*&&\\s*result\\.success\\s*&&\\s*result\\.type === ["']${resultType}["']`),
    `${resultType} retries must not require an assistant-message anchor`,
  );
}

assert.equal(
  trackerEditableText({ name: "HP", value: 75, max: 100, color: "#ef4444" }),
  "HP: 75/100",
  "object-shaped tracker values must become editable text instead of invalid React children",
);
assert.equal(trackerEditableText({ nested: true }), '{"nested":true}');

assert.equal(getStreamingCharsPerSecond(30), 30, "streaming speed 30 should reveal exactly 30 characters per second");
assert.equal(getStreamingCharsPerSecond(1), 1, "the slowest streaming speed should remain a true read-along pace");
assert.equal(getStreamingCharsPerSecond(99), 99, "finite streaming speeds should map directly to reveal cadence");
assert.equal(getStreamingCharsPerSecond(100), Infinity, "the final streaming-speed setting should reveal instantly");
assert.equal(
  getStreamingCharsPerSecond(30, true),
  Infinity,
  "reduced-motion preferences should disable the typewriter animation",
);
assert.ok(
  Math.abs(
    getRoleplayTypewriterRevealCharsPerSecond({
      selectedCharsPerSecond: 90,
      pendingCharacters: 45,
      previousCharsPerSecond: null,
      elapsedMs: 16,
      streamComplete: false,
    }) - 50,
  ) < 0.001,
  "Roleplay should turn the first provider burst into a buffered reveal rate",
);
const roleplayAcceleratedRate = getRoleplayTypewriterRevealCharsPerSecond({
  selectedCharsPerSecond: 90,
  pendingCharacters: 90,
  previousCharsPerSecond: 20,
  elapsedMs: 16,
  streamComplete: false,
});
assert.ok(
  roleplayAcceleratedRate > 20 && roleplayAcceleratedRate < 23,
  "Roleplay should ease into a faster reveal instead of copying a provider burst",
);
const roleplayDeceleratedRate = getRoleplayTypewriterRevealCharsPerSecond({
  selectedCharsPerSecond: 90,
  pendingCharacters: 5,
  previousCharsPerSecond: 60,
  elapsedMs: 16,
  streamComplete: false,
});
assert.ok(
  roleplayDeceleratedRate > 52 && roleplayDeceleratedRate < 54,
  "Roleplay should slow promptly as its buffered reserve shrinks",
);
assert.equal(
  getRoleplayTypewriterRevealCharsPerSecond({
    selectedCharsPerSecond: 90,
    pendingCharacters: 5,
    previousCharsPerSecond: 6,
    elapsedMs: 16,
    streamComplete: true,
  }),
  90,
  "a completed Roleplay stream should drain at the selected speed",
);
assert.deepEqual(
  takeTypewriterCharacters("A👩‍🔬B", 2),
  { visibleText: "A👩‍🔬", pendingText: "B", characterCount: 2 },
  "the typewriter should never reveal a partial emoji grapheme",
);
let simulatedThirtyFpsRemainder = 0;
let simulatedThirtyFpsCharacters = 0;
for (let frame = 0; frame < 30; frame += 1) {
  const budget = getTypewriterFrameBudget(50, 1000 / 30, simulatedThirtyFpsRemainder);
  const revealedCharacters = Math.min(Math.floor(budget.accruedCharacters), budget.maxCharacters);
  simulatedThirtyFpsRemainder = budget.accruedCharacters - revealedCharacters;
  simulatedThirtyFpsCharacters += revealedCharacters;
}
assert.equal(
  simulatedThirtyFpsCharacters,
  50,
  "a 30 FPS animation cadence must preserve the configured 50 characters-per-second reveal rate",
);
const delayedFrameBudget = getTypewriterFrameBudget(90, 120, 0);
assert.ok(delayedFrameBudget.accruedCharacters > 10, "a delayed frame should retain its reveal debt");
assert.ok(
  delayedFrameBudget.maxCharacters <= 3,
  "a delayed frame must not dump its entire reveal debt as one chunky typewriter burst",
);
assert.equal(
  getTypewriterPaintIntervalMs(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15",
    "iPhone",
    5,
  ),
  50,
  "iPhone WebKit should batch stream paints to 20 FPS",
);
assert.equal(
  getTypewriterPaintIntervalMs("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", "MacIntel", 5),
  50,
  "desktop-mode iPadOS should receive the same stream paint protection",
);
assert.equal(
  getTypewriterPaintIntervalMs("Mozilla/5.0 (Linux; Android 16)", "Linux armv8l", 5),
  0,
  "non-iOS browsers should retain the native animation cadence",
);
assert.equal(
  shouldUsePersistentTTSAudioCache(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 CriOS/151 Mobile/15E148",
    "iPhone",
    5,
  ),
  false,
  "iOS TTS must avoid persistent IndexedDB Blob writes that can stall WebKit",
);
assert.equal(
  shouldUsePersistentTTSAudioCache("Mozilla/5.0 (Linux; Android 16)", "Linux armv8l", 5),
  true,
  "non-iOS TTS should retain the persistent cache",
);
let simulatedIosRemainder = 0;
let simulatedIosCharacters = 0;
for (let frame = 0; frame < 20; frame += 1) {
  const budget = getTypewriterFrameBudget(90, 50, simulatedIosRemainder, 50);
  const revealedCharacters = Math.min(Math.floor(budget.accruedCharacters), budget.maxCharacters);
  simulatedIosRemainder = budget.accruedCharacters - revealedCharacters;
  simulatedIosCharacters += revealedCharacters;
}
assert.equal(simulatedIosCharacters, 90, "batched iOS paints must preserve the selected reveal speed");
assert.match(
  echoChamberPanelSource,
  /behavior: streamingChatId === activeChatId \? "auto" : "smooth"/u,
  "Echo Chamber should avoid competing smooth-scroll animation while the same Roleplay chat is streaming",
);

assert.equal(
  shouldKeepStreamLiveThroughPostProcessing({
    streamingEnabled: true,
    shouldDisplayRawStream: true,
    isGameGeneration: false,
    isRegeneration: false,
    isContinuation: false,
  }),
  true,
);
assert.equal(
  shouldKeepStreamLiveThroughPostProcessing({
    streamingEnabled: true,
    shouldDisplayRawStream: true,
    isGameGeneration: false,
    isRegeneration: true,
    isContinuation: false,
  }),
  false,
);

assert.deepEqual(
  reconcileTypewriterReplacement("The response is al", "The response is already complete."),
  {
    visibleText: "The response is al",
    pendingText: "ready complete.",
  },
  "ordinary finalization should keep the unrevealed response in the typewriter queue",
);
assert.deepEqual(
  reconcileTypewriterReplacement("\nThe response is al", "The response is already complete."),
  {
    visibleText: "The response is alr",
    pendingText: "eady complete.",
  },
  "leading-whitespace cleanup must not dump the complete response when tracker work starts",
);
assert.deepEqual(
  reconcileTypewriterReplacement("Dottore: The response", "The response is already complete."),
  {
    visibleText: "The response is alrea",
    pendingText: "dy complete.",
  },
  "speaker-prefix cleanup should preserve reveal progress while adopting authoritative text",
);
assert.deepEqual(
  reconcileTypewriterReplacement("Original", "Rewritten response", true),
  {
    visibleText: "",
    pendingText: "Rewritten response",
  },
  "explicit rewrites should still retype from the beginning",
);

assert.equal(
  isMessageShadowedByLiveStream({
    hasLiveStream: true,
    regenerateMessageId: null,
    streamedMessageId: "saved-assistant",
    messageId: "saved-assistant",
  }),
  true,
  "the durable copy of an active presentation stream should not render beside it",
);
assert.equal(
  isMessageShadowedByLiveStream({
    hasLiveStream: true,
    regenerateMessageId: null,
    streamedMessageId: "current-group-reply",
    messageId: "previous-group-reply",
  }),
  false,
  "earlier group replies must remain visible while the next reply streams",
);
assert.equal(
  isMessageShadowedByLiveStream({
    hasLiveStream: true,
    regenerateMessageId: "saved-assistant",
    streamedMessageId: "saved-assistant",
    messageId: "saved-assistant",
  }),
  false,
  "regeneration owns the existing row in place and must not hide it",
);
const messageSavedHandlerSource =
  useGenerateSource.match(/case "message_saved": \{[\s\S]*?case "assistant_message_ready":/u)?.[0] ?? "";
assert.match(
  messageSavedHandlerSource,
  /if \(!keepStreamLiveThroughPostProcessing\) \{[\s\S]*?rememberContinuedMessageContent\(savedMessage\);[\s\S]*?\}/u,
  "saved Roleplay replies should retain their continuation handoff",
);
const messageSavedCacheUpdateCount = (messageSavedHandlerSource.match(/upsertPersistedMessages\(/gu) ?? []).length;
assert.equal(
  messageSavedCacheUpdateCount,
  2,
  "saved Roleplay replies should enter the cache while Game replies wait for the final scene handoff",
);
assert.equal(
  (
    messageSavedHandlerSource.match(
      /if \(!isGameGeneration(?: && \(!streamingEnabled \|\| !shouldDisplayRawStream\))?\) (?:\{\s*)?upsertPersistedMessages\(qc, params\.chatId, \[(?:heldMessage|savedMessage)\]\);/gu,
    ) ?? []
  ).length,
  messageSavedCacheUpdateCount,
  "every message_saved cache update should remain behind a Game-mode guard",
);
const selfieHandlerSource = useGenerateSource.match(/case "selfie": \{[\s\S]*?case "selfie_error":/u)?.[0] ?? "";
assert.match(
  selfieHandlerSource,
  /if \(!streamingEnabled && !isGameGeneration\) \{[\s\S]*?refreshMessagesAuthoritatively/u,
  "selfies should not refresh the visible cache during Game generation",
);
const illustrationHandlerSource =
  useGenerateSource.match(/case "illustration": \{[\s\S]*?case "illustration_queued":/u)?.[0] ?? "";
assert.match(
  illustrationHandlerSource,
  /if \(!streamingEnabled && !isGameGeneration\) \{[\s\S]*?refreshMessagesAuthoritatively/u,
  "illustrations should not refresh the visible cache during Game generation",
);
assert.match(
  useGenerateSource,
  /if \(isGameGeneration\) \{[\s\S]*?await refreshMessagesAuthoritatively\(qc, params\.chatId, persistedForRefresh\);[\s\S]*?setStreaming\(false\);/u,
  "Game generation should publish the authoritative scene before releasing its presentation stream",
);
const updateMessageHookSource =
  useChatsSource.match(/export function useUpdateMessage[\s\S]*?export function useUpdateMessageExtra/u)?.[0] ?? "";
assert.match(
  updateMessageHookSource,
  /const cancellation = qc\.cancelQueries[\s\S]*?qc\.setQueryData[\s\S]*?await cancellation/u,
  "message edits should paint optimistically before query cancellation finishes",
);

assert.match(
  generateHookSource,
  /const cancellation = qc\.cancelQueries[\s\S]*?id: `__optimistic_\$\{Date\.now\(\)\}`[\s\S]*?qc\.setQueryData[\s\S]*?await cancellation/u,
  "submitted user messages should paint optimistically before query cancellation finishes",
);
assert.match(
  generateHookSource,
  /qc\.cancelQueries\([\s\S]{0,180}silent: true, revert: false/u,
  "message query cancellation must not roll back the optimistic submitted message",
);

const makeAgent = (type: string, resultType: string): ResolvedAgent =>
  ({
    id: type,
    type,
    name: type,
    phase: "post_processing",
    promptTemplate: `${type} prompt`,
    connectionId: "connection-1",
    settings: { resultType, holdForRewrite: true },
    provider: {},
    model: "agent-model",
  }) as ResolvedAgent;

const rewriteAgents = [
  makeAgent("prose-guardian", "text_rewrite"),
  makeAgent("continuity", "text_rewrite"),
  makeAgent("html", "text_rewrite"),
];
const trackerAgent = makeAgent("world-state", "game_state_update");
const merged = mergePairedBuiltInRewriteAgents([...rewriteAgents, trackerAgent]);

assert.equal(merged.length, 2, "the three built-in rewrite agents should share one editor call");
assert.match(merged[0]!.name, /prose-guardian.*continuity.*html/u);
assert.equal(getAgentBatchLane(merged[0]!), "rewrite");
assert.equal(getAgentBatchLane(trackerAgent), "standard");
assert.equal(
  estimateAgentLoadCost(
    [
      ...rewriteAgents.map((agent) => ({
        type: agent.type,
        phase: "post_processing" as const,
        connectionId: "connection-1",
        promptTemplate: agent.promptTemplate,
        resultType: "text_rewrite",
      })),
      {
        type: trackerAgent.type,
        phase: "post_processing" as const,
        connectionId: "connection-1",
        promptTemplate: trackerAgent.promptTemplate,
        resultType: "game_state_update",
      },
    ],
    null,
  ).extraCalls,
  2,
  "rewrite editors should count as one call separate from the tracker call",
);

class CountingTrackerBatchProvider extends BaseLLMProvider {
  calls = 0;

  constructor() {
    super("http://localhost", "");
  }

  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, void, unknown> {
    return;
  }

  override async chatComplete(_messages: ChatMessage[], _options: ChatOptions): Promise<ChatCompletionResult> {
    this.calls += 1;
    return {
      content: JSON.stringify({
        expression: { expressions: [] },
        "world-state": { date: "Unknown", time: "Night" },
        background: { chosen: null, generate: null },
      }),
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
    };
  }
}

const trackerBatchProvider = new CountingTrackerBatchProvider();
const trackerBatchDebugEvents: AgentCallDebugEvent[] = [];
const fallbackResolvedAgents = await resolveAgentPipelineAgents({
  connections: {
    getDefaultForAgents: async () => null,
    getFallbackForAgents: async () => null,
    getWithKey: async () => null,
  } as unknown as Parameters<typeof resolveAgentPipelineAgents>[0]["connections"],
  configuredAgents: [
    { ...makeAgent("expression", "sprite_change"), connectionId: null },
    { ...makeAgent("world-state", "game_state_update"), connectionId: null },
    { ...makeAgent("background", "background_change"), connectionId: null },
  ],
  chatId: "tracker-batch-regression",
  chatEnableAgents: true,
  hasPerChatAgentList: false,
  perChatAgentSet: new Set<string>(),
  agentPromptTemplateSelections: {},
  chatProvider: trackerBatchProvider,
  chatConnectionId: "chat-connection",
  chatModel: "agent-model",
  chatCustomParameters: {},
  chatMaxOutputTokens: null,
  chatMaxParallelJobs: 1,
  chatEnableCaching: false,
  chatAnthropicExtendedCacheTtl: false,
  chatCachingAtDepth: 5,
  resolveBaseUrl: () => "",
});

assert.equal(fallbackResolvedAgents.resolvedAgents.length, 3);
assert.ok(
  fallbackResolvedAgents.resolvedAgents.every(
    (agent) => agent.provider === fallbackResolvedAgents.resolvedAgents[0]!.provider,
  ),
  "ordinary generation should reuse one provider wrapper when agents share the chat fallback connection",
);

const trackerBatchResults = await executeAgentBatch(
  [
    makeAgent("expression", "sprite_change"),
    makeAgent("world-state", "game_state_update"),
    makeAgent("background", "background_change"),
  ],
  {
    chatId: "tracker-batch-regression",
    chatMode: "roleplay",
    recentMessages: [],
    mainResponse: "Night settles over the lake.",
    gameState: null,
    characters: [],
    persona: null,
    memory: {},
    writableLorebookIds: null,
    chatSummary: null,
    streaming: false,
    agentDebug: (event) => trackerBatchDebugEvents.push(event),
  } satisfies AgentContext,
  trackerBatchProvider,
  "agent-model",
);

assert.equal(trackerBatchProvider.calls, 1, "compatible tracker agents should share one provider request");
assert.equal(trackerBatchResults.length, 3);
assert.ok(trackerBatchResults.every((result) => result.success));
assert.deepEqual(
  trackerBatchDebugEvents.map((event) => ({
    stage: event.stage,
    agentType: event.agentType,
    batchedAgentTypes: event.batchedAgentTypes,
  })),
  [
    {
      stage: "request",
      agentType: "__batch__",
      batchedAgentTypes: ["expression", "world-state", "background"],
    },
    {
      stage: "response",
      agentType: "__batch__",
      batchedAgentTypes: ["expression", "world-state", "background"],
    },
  ],
  "tracker batch debug output should describe the real combined request",
);

const queuedEchoBatch = enqueueEchoChamberMessages(
  {
    messages: [{ characterName: "Watcher", reaction: "The old reaction.", timestamp: 1 }],
    visibleCount: 1,
    baseline: 1,
  },
  [
    { characterName: "Watcher A", reaction: "First new reaction." },
    { characterName: "Watcher B", reaction: "Second new reaction." },
    { characterName: "Watcher C", reaction: "Third new reaction." },
  ],
  100,
);
assert.equal(queuedEchoBatch.messages.length, 4);
assert.equal(queuedEchoBatch.visibleCount, 1, "a fresh Echo result must remain behind the reveal cursor");
assert.equal(queuedEchoBatch.baseline, 1);
assert.equal(getEchoChamberMessageInterval(12), 12_000);
assert.equal(normalizeEchoChamberMessageDelaySeconds(undefined), DEFAULT_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS);
assert.equal(normalizeEchoChamberMessageDelaySeconds(null), DEFAULT_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS);
assert.equal(normalizeEchoChamberMessageDelaySeconds("  "), DEFAULT_ECHO_CHAMBER_MESSAGE_DELAY_SECONDS);
assert.equal(normalizeEchoChamberMessageDelaySeconds(0), 1);
assert.equal(normalizeEchoChamberMessageDelaySeconds(999), 300);

const staleEchoCursor = enqueueEchoChamberMessages(
  { messages: [], visibleCount: 99, baseline: 99 },
  [{ characterName: "Watcher", reaction: "Do not dump me." }],
  200,
);
assert.equal(staleEchoCursor.visibleCount, 0, "stale reveal counters must clamp before a new batch is queued");
assert.equal(
  resolveEchoChamberPersistedBaseline(
    [
      { characterName: "Old", reaction: "Persisted history.", timestamp: 50 },
      { characterName: "New A", reaction: "Generated during load.", timestamp: 101 },
      { characterName: "New B", reaction: "Also generated during load.", timestamp: 101 },
    ],
    100,
  ),
  1,
  "an Echo result persisted during the initial load must stay queued instead of appearing all at once",
);

useAgentStore.setState({
  echoMessages: queuedEchoBatch.messages,
  echoVisibleCount: queuedEchoBatch.visibleCount,
  echoBaseline: queuedEchoBatch.baseline,
});
useAgentStore.getState().revealNextEchoMessage();
assert.equal(useAgentStore.getState().echoVisibleCount, 2, "one Echo timer tick must reveal exactly one reaction");
useAgentStore.getState().revealNextEchoMessage();
assert.equal(
  useAgentStore.getState().echoVisibleCount,
  3,
  "a second Echo timer tick must reveal only the next reaction",
);

let weatherAccumulator = 0;
let weatherDraws = 0;
for (let frame = 0; frame < 6; frame++) {
  const step = advanceWeatherFrameClock(weatherAccumulator, 1000 / 60);
  weatherAccumulator = step.accumulatedMs;
  if (step.shouldDraw) weatherDraws++;
}
assert.equal(weatherDraws, 3, "60 Hz foreground callbacks should produce an even 30 FPS weather cadence");

const legacyRewrite = resolveMessageRewriteVersions(
  "The polished rewritten reply.",
  { proseGuardianOriginalText: "The original reply." },
  false,
);
assert.equal(legacyRewrite.hasVersions, true, "legacy one-way restore metadata should remain recoverable");
assert.equal(legacyRewrite.alternateText, "The original reply.");

const restoredOriginal = resolveMessageRewriteVersions(
  "The original reply.",
  {
    proseGuardianOriginalText: "The original reply.",
    proseGuardianRewrittenText: "The polished rewritten reply.",
  },
  false,
);
assert.equal(restoredOriginal.hasVersions, true, "the shield should remain after showing the original");
assert.equal(restoredOriginal.showingOriginal, true);
assert.equal(restoredOriginal.alternateText, "The polished rewritten reply.");

const restoredRewrite = resolveMessageRewriteVersions(
  "The polished rewritten reply.",
  {
    proseGuardianOriginalText: "The original reply.",
    proseGuardianRewrittenText: "The polished rewritten reply.",
  },
  false,
);
assert.equal(restoredRewrite.showingOriginal, false);
assert.equal(restoredRewrite.alternateText, "The original reply.");

const previousTTSMessage = {
  id: "assistant-1",
  role: "assistant",
  content: "The previous successful reply.",
  activeSwipeIndex: 0,
};
const previousTTSRevision = getTTSAutoplayRevision(previousTTSMessage);
assert.equal(
  shouldAutoplayGeneratedTTS({
    beforeRevision: previousTTSRevision,
    message: previousTTSMessage,
    generationFailed: false,
  }),
  false,
  "ending a generation without a new assistant revision must not replay the previous audio",
);
assert.equal(
  shouldAutoplayGeneratedTTS({
    beforeRevision: previousTTSRevision,
    message: { ...previousTTSMessage, content: "A partial reply before failure." },
    generationFailed: true,
  }),
  false,
  "a failed generation must not autoplay even if partial assistant text was persisted",
);
assert.equal(
  shouldAutoplayGeneratedTTS({
    beforeRevision: previousTTSRevision,
    message: { id: "assistant-2", role: "assistant", content: "A successful new reply.", activeSwipeIndex: 0 },
    generationFailed: false,
  }),
  true,
  "a successful new assistant message should still autoplay",
);
assert.equal(
  shouldAutoplayGeneratedTTS({
    beforeRevision: previousTTSRevision,
    message: { ...previousTTSMessage, activeSwipeIndex: 1 },
    generationFailed: false,
  }),
  true,
  "a successful regenerated swipe should still autoplay even when its text happens to match",
);
assert.equal(
  findLatestTTSAutoplayMessage([
    previousTTSMessage,
    { id: "user-2", role: "user", content: "Try again.", activeSwipeIndex: 0 },
  ])?.id,
  previousTTSMessage.id,
  "the generation baseline should ignore the user's newest input",
);

process.stdout.write("Roleplay streaming regression passed.\n");
