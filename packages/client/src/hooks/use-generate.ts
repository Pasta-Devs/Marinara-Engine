// ──────────────────────────────────────────────
// React Query: Generation (streaming + agent pipeline)
// ──────────────────────────────────────────────
import { useCallback, useRef } from "react";
import type { AvatarCropValue } from "../lib/utils";
import { useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { toast, type ExternalToast } from "sonner";
import { api, ApiError } from "../lib/api-client";
import {
  formatAgentFailuresToast,
  illustratorRetryTargetsForFailures,
  mergeAgentFailures,
  toAgentFailure,
  type AgentFailure,
  type IllustratorRetryTarget,
} from "../lib/agent-failures";
import { chatBackgroundMetadataToUrl, chatBackgroundUrlToMetadata } from "../lib/backgrounds";
import { formatGenerationParameterError } from "../lib/generation-parameter-errors";
import {
  getTypewriterRevealCharsPerSecond,
  isGenerationStartBlocked,
  reconcileTypewriterReplacement,
  shouldKeepStreamLiveThroughPostProcessing,
} from "../lib/generation-stream-policy";
import { requestChatScrollToBottom } from "../lib/chat-scroll-events";
import { startSceneWithPromptPreferences } from "../lib/scene-generation";
import { waitForPendingChatMetadataSaves } from "../lib/chat-metadata-save-barrier";
import { agentKeys } from "./use-agents";
import { discardPendingGameStatePatch } from "./use-game-state-patcher";
import { spatialContextKeys } from "./use-spatial-context";
import type { PendingAgentWriteApproval, PendingCardUpdate } from "../stores/agent.store";
import type { DelayedCharacterInfo } from "../stores/chat.store";
import {
  applyQuestUpdatesToPlayerStats,
  applyTrackerFieldLocksToGameStatePatch,
  BUILT_IN_AGENTS,
  createInlineThinkingStreamFilter,
  EDITABLE_CHARACTER_CARD_FIELDS,
  normalizeThinkingTagPairs,
  resolveChatPersonaCandidate,
  type AgentWriteApprovalProposal,
  type AgentCallDebugEvent,
  type CharacterCardFieldUpdate,
  type EditableCharacterCardField,
  type MariGuidedPlanStep,
  type MariSuggestionChip,
  type PendingSpatialTransition,
  type SpatialContextResponse,
  type ThinkingTagPair,
} from "@marinara-engine/shared";

type RetryAgentsOptions = {
  lorebookKeeperBackfill?: boolean;
  forMessageId?: string;
  secretPlotRerollMode?: "full" | "turn_only";
  agentPromptTemplateIds?: Record<string, string>;
  illustratorPromptReviewOverride?: {
    resultData: Record<string, unknown>;
    prompt: string;
    negativePrompt?: string;
  };
  illustratorRetryTargets?: IllustratorRetryTarget[];
};

type RetryAgentsFn = (chatId: string, agentTypes: string[], options?: RetryAgentsOptions) => Promise<boolean>;

function withIllustratorFailureTargets(
  options: RetryAgentsOptions | undefined,
  failures: AgentFailure[],
): RetryAgentsOptions | undefined {
  const baseOptions: RetryAgentsOptions = { ...options };
  delete baseOptions.illustratorRetryTargets;
  const illustratorRetryTargets = illustratorRetryTargetsForFailures(failures);
  if (illustratorRetryTargets) return { ...baseOptions, illustratorRetryTargets };
  return Object.keys(baseOptions).length > 0 ? baseOptions : undefined;
}

/** Show a persistent, copyable error toast and log to console */
function showError(msg: string, options?: Pick<ExternalToast, "action">) {
  const formatted = formatGenerationParameterError(msg);
  console.error("[Generation]", msg);
  toast.error(formatted, { duration: 15000, ...options });
}

function showAgentFailuresError(failures: AgentFailure[], onRetry?: () => void) {
  const hasIllustratorFailure = failures.some((failure) => failure.agentType === "illustrator");
  showError(
    formatAgentFailuresToast(failures),
    hasIllustratorFailure && onRetry
      ? {
          action: {
            label: "Try again",
            onClick: () => onRetry(),
          },
        }
      : undefined,
  );
}

const shownAgentWarnings = new Set<string>();
const isBuiltInAgentType = (agentType: string) => BUILT_IN_AGENTS.some((agent) => agent.id === agentType);
const isBuiltInTrackerAgentType = (agentType: string) =>
  BUILT_IN_AGENTS.some((agent) => agent.id === agentType && agent.category === "tracker" && !agent.libraryHidden);

type AgentWarningToastData = {
  code?: unknown;
  message?: unknown;
  connectionId?: unknown;
  connectionName?: unknown;
  model?: unknown;
};

function readAgentWarningString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getAgentWarningToastKey(data: AgentWarningToastData | null, chatId: string, message: string): string {
  const code = readAgentWarningString(data?.code) ?? "agent_warning";

  if (code === "default_agent_connection_active") {
    const connectionSignature =
      readAgentWarningString(data?.connectionId) ?? readAgentWarningString(data?.connectionName) ?? "unknown";
    const modelSignature = readAgentWarningString(data?.model) ?? "unknown";
    return `${chatId}:${code}:${connectionSignature}:${modelSignature}`;
  }

  return `${code}:${message}`;
}

function showAgentWarning(raw: unknown, chatId: string) {
  const data = raw && typeof raw === "object" ? (raw as AgentWarningToastData) : null;
  const message = typeof data?.message === "string" ? data.message : "Agent warning";
  const warningKey = getAgentWarningToastKey(data, chatId, message);
  console.warn("[Agent warning]", raw);
  if (shownAgentWarnings.has(warningKey)) return;
  shownAgentWarnings.add(warningKey);
  toast.warning(message, { duration: 20000 });
}

function applyAgentBackgroundChoice(chosen: string | null | undefined) {
  const url = chatBackgroundMetadataToUrl(chosen);
  if (!url) return;

  fetch(url, { method: "HEAD" })
    .then((res) => {
      if (res.ok) {
        useUIStore.getState().setChatBackground(url);
      } else {
        console.warn(`[Agent] Background "${chosen}" does not exist — skipping`);
      }
    })
    .catch(() => {});
}

function applyAgentFrontendStyle(chatId: string, raw: unknown) {
  if (typeof document === "undefined") return;
  if (!raw || typeof raw !== "object") return;
  const data = raw as Record<string, unknown>;
  const css = typeof data.css === "string" ? data.css.trim() : "";
  if (!css) return;
  const durationMs =
    typeof data.durationMs === "number" && Number.isFinite(data.durationMs)
      ? Math.max(1_000, Math.min(10 * 60_000, Math.trunc(data.durationMs)))
      : 60_000;
  const id = `marinara-agent-style-${chatId}`;
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);
  }
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  style.dataset.agentStyleToken = token;
  style.textContent = css;
  window.setTimeout(() => {
    const current = document.getElementById(id) as HTMLStyleElement | null;
    if (current?.dataset.agentStyleToken === token) current.remove();
  }, durationMs);
}

function isChatSurfaceVisible(chatId: string) {
  const chatState = useChatStore.getState();
  if (chatState.activeChatId !== chatId) return false;
  return !useUIStore.getState().hasAnyDetailOpen();
}

const editableCharacterCardFieldSet = new Set<string>(EDITABLE_CHARACTER_CARD_FIELDS);

function formatToolDebugPayload(value: unknown, maxLength = 1_200): string {
  const raw =
    typeof value === "string"
      ? value
      : (() => {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value ?? "");
          }
        })();
  return raw.length > maxLength ? `${raw.slice(0, maxLength)}...` : raw;
}

/**
 * Validate one entry in the Card Evolution Auditor's `updates` array and coerce
 * it to a typed CharacterCardFieldUpdate. LLM output can be messy, so we drop
 * anything that doesn't parse cleanly.
 */
function parseCardFieldUpdate(raw: unknown): CharacterCardFieldUpdate | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  if (u.action !== "update") return null;
  if (typeof u.characterId !== "string" || u.characterId.trim().length === 0) return null;
  if (typeof u.field !== "string" || !editableCharacterCardFieldSet.has(u.field)) return null;
  if (typeof u.oldText !== "string") return null;
  if (typeof u.newText !== "string") return null;
  if (u.oldText === u.newText) return null;
  return {
    characterId: u.characterId.trim(),
    action: "update",
    field: u.field as EditableCharacterCardField,
    oldText: u.oldText,
    newText: u.newText,
    reason: typeof u.reason === "string" ? u.reason : "",
  };
}

function parseCharacterRowData(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

type CachedCharacterRow = {
  id?: string;
  data?: unknown;
  avatarPath?: string | null;
  name?: string;
};

function resolveCachedCharacterIdentity(
  qc: QueryClient,
  characterId: string | null | undefined,
  fallbackName: string | null | undefined = "Character",
): {
  name: string | null;
  avatarUrl: string | null;
  avatarCrop?: AvatarCropValue | null;
} {
  if (!characterId) return { name: fallbackName, avatarUrl: null };

  const detail = qc.getQueryData<CachedCharacterRow>(characterKeys.detail(characterId));
  const list = qc.getQueryData<CachedCharacterRow[]>(characterKeys.list());
  const row = detail ?? list?.find((character) => character.id === characterId);
  const parsed = parseCharacterRowData(row?.data);
  const name =
    (parsed && typeof parsed.name === "string" && parsed.name.trim()) ||
    (typeof row?.name === "string" && row.name.trim()) ||
    fallbackName ||
    "Character";
  const avatarCrop =
    parsed && typeof parsed.extensions === "object" && parsed.extensions && "avatarCrop" in parsed.extensions
      ? ((parsed.extensions as { avatarCrop?: AvatarCropValue | null }).avatarCrop ?? null)
      : null;

  return {
    name,
    avatarUrl: row?.avatarPath ?? null,
    avatarCrop,
  };
}

function latestMessage(messages: Iterable<Message>): Message | null {
  let latest: Message | null = null;
  for (const message of messages) {
    if (!latest || new Date(message.createdAt).getTime() >= new Date(latest.createdAt).getTime()) {
      latest = message;
    }
  }
  return latest;
}

function latestAssistantMessage(messages: Iterable<Message>): Message | null {
  return latestMessage([...messages].filter((message) => message.role === "assistant"));
}

function resolveNotifiedCharacterId(
  message: Message | null,
  forCharacterId: string | undefined,
  fallbackCharacterId: string | null,
): string | null {
  return message?.characterId ?? forCharacterId ?? fallbackCharacterId;
}

function getCachedMessages(qc: QueryClient, chatId: string): Message[] {
  return qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId))?.pages.flat() ?? [];
}

function assistantMessageFingerprint(message: Message): string {
  return JSON.stringify([
    message.content,
    message.activeSwipeIndex,
    message.swipeCount ?? null,
    message.extra?.displayText ?? null,
    message.extra?.proseGuardianRewrittenAt ?? null,
  ]);
}

type MessageSnapshot = {
  cacheWasLoaded: boolean;
  fingerprints: ReadonlyMap<string, string>;
};

function snapshotMessagesByRole(qc: QueryClient, chatId: string, role: Message["role"]): MessageSnapshot {
  const cached = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId));
  return {
    cacheWasLoaded: cached !== undefined,
    fingerprints: new Map(
      (cached?.pages.flat() ?? [])
        .filter((message) => message.role === role)
        .map((message) => [message.id, assistantMessageFingerprint(message)]),
    ),
  };
}

function latestNewMessageByRole(
  qc: QueryClient,
  chatId: string,
  role: Message["role"],
  snapshot: MessageSnapshot,
): Message | null {
  if (!snapshot.cacheWasLoaded) return null;
  return latestMessage(
    getCachedMessages(qc, chatId).filter((message) => message.role === role && !snapshot.fingerprints.has(message.id)),
  );
}

function latestChangedAssistantMessage(
  qc: QueryClient,
  chatId: string,
  snapshot: MessageSnapshot,
): Message | null {
  if (!snapshot.cacheWasLoaded) return null;
  return latestAssistantMessage(
    getCachedMessages(qc, chatId).filter(
      (message) =>
        message.role === "assistant" && snapshot.fingerprints.get(message.id) !== assistantMessageFingerprint(message),
    ),
  );
}

function createCacheOnlyPartialMessage(params: {
  chatId: string;
  role: Message["role"];
  characterId: string | null;
  content: string;
  createdAt: string;
}): Message {
  return {
    id: `__partial_${params.chatId}_${Date.now()}`,
    chatId: params.chatId,
    role: params.role,
    characterId: params.characterId,
    content: params.content,
    activeSwipeIndex: 0,
    extra: {
      displayText: null,
      isGenerated: params.role === "assistant",
      tokenCount: null,
      generationInfo: null,
    },
    createdAt: params.createdAt,
  };
}

function replyNotificationTitle(mode: Chat["mode"] | undefined, characterName: string | null): string | undefined {
  if (mode === "game") return "Game turn is ready";
  if (characterName) return undefined;
  if (mode === "roleplay") return "Roleplay reply is ready";
  if (mode === "visual_novel") return "Visual Novel reply is ready";
  if (mode === "conversation") return "New message is ready";
  return "Reply is ready";
}

/**
 * Build one or more PendingCardUpdate batches from a character_card_update
 * agent result. Each batch is scoped to a single characterId so the approval
 * modal can review and apply updates without ownership heuristics.
 */
async function buildPendingCardUpdates(
  qc: QueryClient,
  chatId: string,
  agentType: string,
  agentName: string,
  rawData: unknown,
): Promise<PendingCardUpdate[]> {
  const data = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : null;
  const rawUpdates = data && Array.isArray(data.updates) ? (data.updates as unknown[]) : [];
  const updates = rawUpdates.map(parseCardFieldUpdate).filter((u): u is CharacterCardFieldUpdate => u !== null);
  if (updates.length === 0) return [];

  const chat = qc.getQueryData<Chat>(chatKeys.detail(chatId));
  // characterIds is sometimes serialized as a JSON string on the wire —
  // accept either shape to avoid a .map crash on group chats.
  const rawChatCharIds = (chat as { characterIds?: unknown })?.characterIds;
  let chatCharacterIds: string[] = [];
  if (Array.isArray(rawChatCharIds)) {
    chatCharacterIds = rawChatCharIds.filter((v): v is string => typeof v === "string");
  } else if (typeof rawChatCharIds === "string") {
    try {
      const parsed = JSON.parse(rawChatCharIds);
      if (Array.isArray(parsed)) chatCharacterIds = parsed.filter((v): v is string => typeof v === "string");
    } catch {
      /* leave empty */
    }
  }
  if (chatCharacterIds.length === 0) return [];
  const chatCharacterIdSet = new Set(chatCharacterIds);

  // Prime the characters list cache if empty so we can resolve names.
  let characters = qc.getQueryData<Array<{ id: string; data?: unknown; name?: string }>>(characterKeys.list());
  if (!characters) {
    try {
      characters = await qc.fetchQuery({
        queryKey: characterKeys.list(),
        queryFn: () => api.get<Array<{ id: string; data?: unknown; name?: string }>>("/characters"),
      });
    } catch {
      characters = undefined;
    }
  }
  const chatCharacters = new Map(
    chatCharacterIds.map((id) => {
      const row = characters?.find((character) => character.id === id);
      const parsed = parseCharacterRowData(row?.data);
      return [id, { row, parsed }] as const;
    }),
  );

  const groupedUpdates = new Map<string, CharacterCardFieldUpdate[]>();
  for (const update of updates) {
    if (!chatCharacterIdSet.has(update.characterId)) continue;

    const existing = groupedUpdates.get(update.characterId) ?? [];
    existing.push(update);
    groupedUpdates.set(update.characterId, existing);
  }

  if (groupedUpdates.size === 0) return [];

  const timestamp = Date.now();
  return chatCharacterIds.flatMap((characterId, index) => {
    const grouped = groupedUpdates.get(characterId);
    if (!grouped || grouped.length === 0) return [];

    const character = chatCharacters.get(characterId);
    const characterName =
      (character?.parsed && typeof character.parsed.name === "string" && character.parsed.name) ||
      character?.row?.name ||
      "Character";

    return [
      {
        id: `card-update-${characterId}-${timestamp}-${index}`,
        chatId,
        agentType,
        characterId,
        characterName,
        updates: grouped,
        agentName,
        timestamp: timestamp + index,
      },
    ];
  });
}

function readAgentWriteApprovalProposal(
  raw: unknown,
  fallback?: { chatId?: string; agentType?: string | null; agentName?: string },
): AgentWriteApprovalProposal | null {
  const envelope = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const source =
    envelope?.requiresApproval === true && envelope.approval && typeof envelope.approval === "object"
      ? (envelope.approval as Record<string, unknown>)
      : envelope;
  if (!source) return null;
  const kind = source.kind === "lorebook_update" || source.kind === "summary_update" ? source.kind : null;
  if (!kind) return null;

  const chatId =
    typeof source.chatId === "string" && source.chatId.trim()
      ? source.chatId.trim()
      : typeof fallback?.chatId === "string"
        ? fallback.chatId
        : "";
  const text = typeof source.text === "string" ? source.text : "";
  if (!chatId || !text.trim()) return null;

  const agentType =
    typeof source.agentType === "string" && source.agentType.trim()
      ? source.agentType.trim()
      : (fallback?.agentType ?? null);
  const agentName =
    typeof source.agentName === "string" && source.agentName.trim()
      ? source.agentName.trim()
      : (fallback?.agentName ?? agentType ?? "Agent");
  const title =
    typeof source.title === "string" && source.title.trim() ? source.title.trim() : `${agentName} proposed an update`;
  const payload =
    source.payload && typeof source.payload === "object" && !Array.isArray(source.payload)
      ? (source.payload as Record<string, unknown>)
      : undefined;
  const createdAt = typeof source.createdAt === "string" ? source.createdAt : "";

  return {
    kind,
    chatId,
    agentType,
    agentName,
    title,
    text,
    ...(payload ? { payload } : {}),
    canRegenerate: source.canRegenerate === true,
    ...(createdAt ? { createdAt } : {}),
  };
}

function createPendingAgentWriteApproval(proposal: AgentWriteApprovalProposal): PendingAgentWriteApproval {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `agent-write-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    ...proposal,
    id,
    timestamp: Date.now(),
  };
}
import { useChatStore } from "../stores/chat.store";
import { useAgentStore } from "../stores/agent.store";
import { useGameModeStore } from "../stores/game-mode.store";
import { useGameStateStore } from "../stores/game-state.store";
import { useTranslationStore } from "../stores/translation.store";
import { useUIStore } from "../stores/ui.store";
import {
  applyRecentMessageContentEditsToData,
  chatKeys,
  forgetRecentMessageContentEdit,
  preserveRecentMessageContentEdit,
  rememberRecentMessageContentEdit,
} from "./use-chats";
import { characterKeys } from "./use-characters";
import { connectionKeys } from "./use-connections";
import { lorebookKeys } from "./use-lorebooks";
import { presetKeys } from "./use-presets";
import { playConfiguredNotificationPing } from "../lib/notification-sound";
import { showLocalMessageNotification, showNativeMessageNotification } from "../lib/local-notifications";
import { dispatchCapabilityClientEvent } from "../lib/capability-client-events";
import { messageHasPendingPostProcessing, parseMessageExtraRecord } from "../lib/chat-message-extra";
import { stripGmTagsKeepReadables } from "../lib/game-tag-parser";
import type { APIConnection, Chat, GameMap, Message } from "@marinara-engine/shared";

function sortMessagesByCreatedAt(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const createdAtOrder = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdAtOrder !== 0) return createdAtOrder;
    return 0;
  });
}

function mergeCachedGeneratedMessage(existing: Message, incoming: Message): Message {
  const merged = { ...existing, ...incoming };
  const existingSwipeCount = typeof existing.swipeCount === "number" ? existing.swipeCount : 0;
  const incomingSwipeCount = typeof incoming.swipeCount === "number" ? incoming.swipeCount : 0;
  const activeSwipeFloor =
    typeof incoming.activeSwipeIndex === "number" && Number.isInteger(incoming.activeSwipeIndex)
      ? incoming.activeSwipeIndex + 1
      : 0;
  if (existingSwipeCount || incomingSwipeCount || activeSwipeFloor) {
    merged.swipeCount = Math.max(existingSwipeCount, incomingSwipeCount, activeSwipeFloor);
  }
  const existingExtra = parseMessageExtraRecord(existing.extra);
  const incomingExtra = parseMessageExtraRecord(incoming.extra);
  // The saved-message SSE snapshot can predate post-processing extras such as
  // expression avatars or illustration attachments already present in cache.
  if (Object.keys(existingExtra).length > 0 || Object.keys(incomingExtra).length > 0) {
    merged.extra = { ...existingExtra, ...incomingExtra } as unknown as Message["extra"];
  }
  return merged;
}

function upsertPersistedMessages(qc: QueryClient, chatId: string, incoming: Message[]) {
  if (incoming.length === 0) return;

  const sortedIncoming = sortMessagesByCreatedAt(
    incoming.map((message) => preserveRecentMessageContentEdit(chatId, message)),
  );

  qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) => {
    if (!old?.pages) {
      return {
        pageParams: [undefined],
        pages: [sortedIncoming],
      };
    }

    const persistedById = new Map(sortedIncoming.map((msg) => [msg.id, msg]));
    const existingIds = new Set<string>();

    const pages = old.pages.map((page) =>
      page.map((msg) => {
        existingIds.add(msg.id);
        const persisted = persistedById.get(msg.id);
        return persisted ? mergeCachedGeneratedMessage(msg, persisted) : msg;
      }),
    );

    const missing = sortedIncoming.filter((msg) => !existingIds.has(msg.id));
    if (missing.length > 0) {
      if (pages.length === 0) {
        pages.push(missing);
      } else {
        pages[0] = sortMessagesByCreatedAt([...pages[0], ...missing]);
      }
    }

    return { ...old, pages };
  });
}

function appendMissingPersistedMessages(qc: QueryClient, chatId: string, incoming: Message[]) {
  if (incoming.length === 0) return;

  const sortedIncoming = sortMessagesByCreatedAt(
    incoming.map((message) => preserveRecentMessageContentEdit(chatId, message)),
  );

  qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) => {
    if (!old?.pages) {
      return {
        pageParams: [undefined],
        pages: [sortedIncoming],
      };
    }

    const existingIds = new Set(old.pages.flatMap((page) => page.map((msg) => msg.id)));
    const missing = sortedIncoming.filter((msg) => !existingIds.has(msg.id));
    if (missing.length === 0) return old;

    const pages = [...old.pages];
    if (pages.length === 0) {
      pages.push(missing);
    } else {
      pages[0] = sortMessagesByCreatedAt([...pages[0], ...missing]);
    }

    return { ...old, pages };
  });
}

function preserveRecentMessageContentEditsInCache(qc: QueryClient, chatId: string) {
  qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(chatId), (old) =>
    applyRecentMessageContentEditsToData(chatId, old),
  );
}

async function refreshMessagesAuthoritatively(
  qc: QueryClient,
  chatId: string,
  persistedMessages: Iterable<Message> = [],
) {
  const msgKey = chatKeys.messages(chatId);
  const persisted = [...persistedMessages];
  let refetchSucceeded = false;

  // Also refresh the total message count used for absolute numbering
  qc.invalidateQueries({ queryKey: chatKeys.messageCount(chatId) });
  qc.invalidateQueries({ queryKey: lorebookKeys.active(chatId) });

  await qc.cancelQueries({ queryKey: msgKey, exact: true });

  try {
    await qc.refetchQueries({ queryKey: msgKey, exact: true, type: "all" }, { throwOnError: true });
    refetchSucceeded = true;
  } catch {
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await qc.refetchQueries({ queryKey: msgKey, exact: true, type: "all" }, { throwOnError: true });
      refetchSucceeded = true;
    } catch {
      /* best-effort — keep any persisted messages we already have */
    }
  }

  if (persisted.length > 0) {
    if (refetchSucceeded) {
      // After a fresh refetch, only append rows that are still missing.
      // Do not overwrite fetched rows with the earlier message_saved snapshot,
      // because later agent work can add attachments or extra fields.
      appendMissingPersistedMessages(qc, chatId, persisted);
    } else {
      upsertPersistedMessages(qc, chatId, persisted);
    }
  }
  preserveRecentMessageContentEditsInCache(qc, chatId);
  return refetchSucceeded;
}

function parseChatMetadata(metadata: Chat["metadata"] | string | null | undefined): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return metadata as Record<string, unknown>;
}

function parseStoredParameterRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function readCustomThinkingTags(raw: unknown): ThinkingTagPair[] | undefined {
  const parsed = parseStoredParameterRecord(raw);
  if (!parsed || !Object.prototype.hasOwnProperty.call(parsed, "customThinkingTags")) return undefined;
  return normalizeThinkingTagPairs(parsed.customThinkingTags);
}

function getCachedConnectionForGeneration(qc: QueryClient, connectionId: string | null | undefined) {
  if (!connectionId) return undefined;
  const detail = qc.getQueryData<APIConnection>(connectionKeys.detail(connectionId));
  if (detail) return detail;
  const list = qc.getQueryData<APIConnection[]>(connectionKeys.list());
  return list?.find((connection) => connection.id === connectionId);
}

function resolveCachedCustomThinkingTags(
  qc: QueryClient,
  chatId: string,
  connectionId: string | null | undefined,
): ThinkingTagPair[] {
  const chat = getCachedChatForGeneration(qc, chatId);
  const chatMeta = parseChatMetadata(chat?.metadata);
  const effectiveConnectionId = connectionId ?? chat?.connectionId ?? null;
  const connectionTags = readCustomThinkingTags(
    getCachedConnectionForGeneration(qc, effectiveConnectionId)?.defaultParameters,
  );
  const chatTags = readCustomThinkingTags(chatMeta.chatParameters);
  return chatTags ?? connectionTags ?? [];
}

function getCachedChatMode(qc: QueryClient, chatId: string): Chat["mode"] | undefined {
  const activeChat = useChatStore.getState().activeChat;
  if (activeChat?.id === chatId) return activeChat.mode;
  const detail = qc.getQueryData<Chat>(chatKeys.detail(chatId));
  if (detail?.mode) return detail.mode;
  const list = qc.getQueryData<Chat[]>(chatKeys.list());
  return list?.find((chat) => chat.id === chatId)?.mode;
}

function getCachedChatForGeneration(qc: QueryClient, chatId: string): Chat | undefined {
  const activeChat = useChatStore.getState().activeChat;
  if (activeChat?.id === chatId) return activeChat;
  const detail = qc.getQueryData<Chat>(chatKeys.detail(chatId));
  if (detail) return detail;
  const list = qc.getQueryData<Chat[]>(chatKeys.list());
  return list?.find((chat) => chat.id === chatId);
}

function getActiveChatBackgroundForGeneration(chatId: string): string | null | undefined {
  if (useChatStore.getState().activeChatId !== chatId) return undefined;
  return chatBackgroundUrlToMetadata(useUIStore.getState().chatBackground);
}

function parseChatCharacterIds(rawIds: unknown): string[] {
  if (Array.isArray(rawIds)) {
    return rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  }
  if (typeof rawIds !== "string") return [];
  try {
    const parsed = JSON.parse(rawIds);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function getCachedCharacterName(qc: QueryClient, characterId: string): string | null {
  const detail = qc.getQueryData<CachedCharacterRow>(characterKeys.detail(characterId));
  const list = qc.getQueryData<CachedCharacterRow[]>(characterKeys.list());
  const row = detail ?? list?.find((character) => character.id === characterId);
  const parsed = parseCharacterRowData(row?.data);
  return (
    (parsed && typeof parsed.name === "string" && parsed.name.trim()) ||
    (typeof row?.name === "string" && row.name.trim()) ||
    null
  );
}

function getCachedChatSpeakerNames(qc: QueryClient, chatId: string): string[] {
  const chat = getCachedChatForGeneration(qc, chatId);
  const ids = parseChatCharacterIds(chat?.characterIds);
  const names = ids.map((id) => getCachedCharacterName(qc, id)).filter((name): name is string => !!name);
  return [...new Set(names)];
}

function normalizeSpeakerLabel(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function firstSpeakerColonIndex(value: string): number {
  const ascii = value.indexOf(":");
  const fullWidth = value.indexOf("：");
  if (ascii === -1) return fullWidth;
  if (fullWidth === -1) return ascii;
  return Math.min(ascii, fullWidth);
}

function createLeadingSpeakerPrefixFilter(initialLabels: string[]) {
  const labels = new Set<string>();
  let normalizedLabels: string[] = [];
  let pending = "";
  let done = false;

  const addLabels = (nextLabels: string[]) => {
    let changed = false;
    for (const label of nextLabels) {
      const trimmed = label.trim();
      if (!trimmed || labels.has(trimmed)) continue;
      labels.add(trimmed);
      changed = true;
    }
    if (changed) {
      normalizedLabels = [...labels].map(normalizeSpeakerLabel).filter(Boolean);
    }
  };

  const finish = () => {
    done = true;
    const flushed = pending;
    pending = "";
    return flushed;
  };

  addLabels(initialLabels);

  return {
    addLabels,
    reset() {
      pending = "";
      done = false;
    },
    discard() {
      pending = "";
      done = true;
    },
    flush() {
      return pending ? finish() : "";
    },
    push(chunk: string) {
      if (done || normalizedLabels.length === 0) return chunk;

      pending += chunk;
      const candidate = pending.trimStart();
      if (!candidate) return "";

      const colonIndex = firstSpeakerColonIndex(candidate);
      const newlineMatch = candidate.match(/[\r\n]/);
      const newlineIndex = newlineMatch?.index ?? -1;

      if (colonIndex >= 0 && (newlineIndex === -1 || newlineIndex > colonIndex)) {
        const label = normalizeSpeakerLabel(candidate.slice(0, colonIndex));
        if (normalizedLabels.includes(label)) {
          done = true;
          pending = "";
          return candidate.slice(colonIndex + 1).replace(/^\s+/, "");
        }
        return finish();
      }

      if (newlineIndex >= 0 || candidate.length > 96) return finish();

      const normalizedCandidate = normalizeSpeakerLabel(candidate);
      const stillPossibleSpeakerPrefix =
        !normalizedCandidate || normalizedLabels.some((label) => label.startsWith(normalizedCandidate));

      return stillPossibleSpeakerPrefix ? "" : finish();
    },
  };
}

function shouldRefreshGameStateAfterGeneration(qc: QueryClient, chatId: string) {
  const chat = getCachedChatForGeneration(qc, chatId);
  if (chat?.mode === "game") return true;
  if (chat?.mode !== "roleplay" && chat?.mode !== "visual_novel") return false;
  const enableAgents = parseChatMetadata(chat.metadata).enableAgents;
  return enableAgents === true || enableAgents === "true";
}

const pendingVisibleGameStateRefreshes = new Map<string, Promise<void>>();
const activeGenerateLocks = new Set<string>();
const PASSIVE_STREAM_SETTLE_POLL_MS = 1_500;
const PASSIVE_STREAM_SETTLE_MAX_WAIT_MS = 30 * 60_000;

function wait(ms: number, signal?: AbortSignal) {
  if (!signal) return new Promise<void>((resolve) => setTimeout(resolve, ms));
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

async function waitForServerGenerationToSettle(chatId: string, signal: AbortSignal) {
  const startedAt = Date.now();
  while (!signal.aborted && Date.now() - startedAt < PASSIVE_STREAM_SETTLE_MAX_WAIT_MS) {
    try {
      const status = await api.get<{ active: boolean }>(`/generate/status/${encodeURIComponent(chatId)}`);
      if (!status.active) return true;
    } catch {
      // The resumed browser may still be restoring network access; keep polling.
    }
    await wait(PASSIVE_STREAM_SETTLE_POLL_MS, signal);
  }
  return false;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isPassiveStreamDisconnect(error: unknown, pageWasHiddenDuringStream: boolean, signal: AbortSignal) {
  if (!pageWasHiddenDuringStream || signal.aborted || isAbortError(error) || error instanceof ApiError) return false;
  return error instanceof Error;
}

async function refreshVisibleGameStateAfterGeneration(chatId: string) {
  const existing = pendingVisibleGameStateRefreshes.get(chatId);
  if (existing) return existing;

  const refreshPromise = (async () => {
    try {
      const gs = await api.get<import("@marinara-engine/shared").GameState | null>(`/chats/${chatId}/game-state`);
      if (useChatStore.getState().activeChatId === chatId) {
        useGameStateStore.getState().setGameState(gs ?? null);
      }
    } catch {
      /* best-effort — SSE patches already populated the store */
    } finally {
      pendingVisibleGameStateRefreshes.delete(chatId);
    }
  })();
  pendingVisibleGameStateRefreshes.set(chatId, refreshPromise);
  return refreshPromise;
}

function slugifyGameMapId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getGameMapId(map: GameMap | null | undefined, fallbackIndex = 0): string | null {
  if (!map) return null;
  const explicit = map.id?.trim();
  if (explicit) return explicit;
  return slugifyGameMapId(map.name || "") || `map-${fallbackIndex + 1}`;
}

function withGameMapCollection(metadata: Record<string, unknown>, map: GameMap): Record<string, unknown> {
  const mapId = getGameMapId(map);
  const existingMaps = Array.isArray(metadata.gameMaps) ? (metadata.gameMaps as GameMap[]) : [];
  const nextMaps = [...existingMaps];
  const existingIndex = nextMaps.findIndex((entry, index) => getGameMapId(entry, index) === mapId);

  if (existingIndex >= 0) {
    nextMaps[existingIndex] = map;
  } else {
    nextMaps.push(map);
  }

  return {
    ...metadata,
    gameMap: map,
    gameMaps: nextMaps,
    activeGameMapId: mapId,
  };
}

function applyGameMapUpdate(qc: QueryClient, chatId: string, map: GameMap) {
  qc.setQueryData<Chat | undefined>(chatKeys.detail(chatId), (current) => {
    if (!current) return current;
    const metadata = withGameMapCollection(parseChatMetadata(current.metadata as Chat["metadata"] | string), map);
    return {
      ...current,
      metadata: metadata as Chat["metadata"],
    };
  });

  const chatStore = useChatStore.getState();
  if (chatStore.activeChat?.id === chatId) {
    const metadata = withGameMapCollection(
      parseChatMetadata(chatStore.activeChat.metadata as Chat["metadata"] | string),
      map,
    );
    chatStore.setActiveChat({
      ...chatStore.activeChat,
      metadata: metadata as Chat["metadata"],
    });
    useGameModeStore.getState().upsertMap(map, true);
  }
}

function applyGameStatePatchToStore(
  chatId: string,
  patch: Record<string, unknown>,
  anchor?: { messageId: string; swipeIndex: number } | null,
) {
  const current = useGameStateStore.getState().current;

  if (current?.chatId === chatId) {
    const lockedPatch = applyTrackerFieldLocksToGameStatePatch(patch, current);
    const merged = { ...current, ...lockedPatch, chatId, ...(anchor ?? {}) };
    if (lockedPatch.playerStats && typeof lockedPatch.playerStats === "object" && current.playerStats) {
      const mergedPS = { ...current.playerStats, ...(lockedPatch.playerStats as object) };
      const patchPS = lockedPatch.playerStats as Record<string, unknown>;
      if (
        Array.isArray(patchPS.activeQuests) &&
        patchPS.activeQuests.length === 0 &&
        current.playerStats.activeQuests?.length > 0
      ) {
        mergedPS.activeQuests = current.playerStats.activeQuests;
      }
      (merged as any).playerStats = mergedPS;
    }
    useGameStateStore.getState().setGameState(merged as any);
    return;
  }

  // Agent data may arrive before the base game state is loaded. Seed a minimal
  // state with chatId so mounted tracker/HUD views recognise it as current.
  useGameStateStore.getState().setGameState({ ...patch, chatId, ...(anchor ?? {}) } as any);
}

/**
 * Hook that handles streaming generation.
 * Returns a function to trigger generation which streams tokens
 * into the chat store, dispatches agent results to the agent store,
 * and invalidates messages on completion.
 */
export function useGenerate() {
  const qc = useQueryClient();
  const retryAgentsRef = useRef<RetryAgentsFn | null>(null);
  // Use individual selectors to avoid re-rendering on every store change
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setMariPhase = useChatStore((s) => s.setMariPhase);
  const setStreamBuffer = useChatStore((s) => s.setStreamBuffer);
  const setStreamCommitted = useChatStore((s) => s.setStreamCommitted);
  const setStreamedMessageId = useChatStore((s) => s.setStreamedMessageId);
  const clearStreamBuffer = useChatStore((s) => s.clearStreamBuffer);
  const appendThinkingBuffer = useChatStore((s) => s.appendThinkingBuffer);
  const clearThinkingBuffer = useChatStore((s) => s.clearThinkingBuffer);
  const setRegenerateMessageId = useChatStore((s) => s.setRegenerateMessageId);
  const setStreamingCharacterId = useChatStore((s) => s.setStreamingCharacterId);
  const setResponseQueue = useChatStore((s) => s.setResponseQueue);
  const completeQueuedResponse = useChatStore((s) => s.completeQueuedResponse);
  const clearResponseQueue = useChatStore((s) => s.clearResponseQueue);
  const setTypingCharacterName = useChatStore((s) => s.setTypingCharacterName);
  const setDelayedCharacterInfo = useChatStore((s) => s.setDelayedCharacterInfo);
  const setProcessing = useAgentStore((s) => s.setProcessing);
  const addResult = useAgentStore((s) => s.addResult);
  const addDebugEntry = useAgentStore((s) => s.addDebugEntry);
  const addThoughtBubble = useAgentStore((s) => s.addThoughtBubble);
  const clearThoughtBubbles = useAgentStore((s) => s.clearThoughtBubbles);
  const enqueueEchoMessages = useAgentStore((s) => s.enqueueEchoMessages);
  const setCyoaChoices = useAgentStore((s) => s.setCyoaChoices);
  const clearCyoaChoices = useAgentStore((s) => s.clearCyoaChoices);
  const setMariChips = useAgentStore((s) => s.setMariChips);
  const clearMariChips = useAgentStore((s) => s.clearMariChips);
  const setMariPlan = useAgentStore((s) => s.setMariPlan);
  const clearMariPlan = useAgentStore((s) => s.clearMariPlan);
  const setYoutubePlay = useAgentStore((s) => s.setYoutubePlay);
  const setYoutubeVolume = useAgentStore((s) => s.setYoutubeVolume);
  const setLocalMusicPlay = useAgentStore((s) => s.setLocalMusicPlay);
  const setLocalMusicVolume = useAgentStore((s) => s.setLocalMusicVolume);
  const enqueuePendingCardUpdate = useAgentStore((s) => s.enqueuePendingCardUpdate);
  const enqueuePendingAgentWriteApproval = useAgentStore((s) => s.enqueuePendingAgentWriteApproval);
  const setFailedAgentFailures = useAgentStore((s) => s.setFailedAgentFailures);
  const clearFailedAgentTypes = useAgentStore((s) => s.clearFailedAgentTypes);

  const generate = useCallback(
    async (params: {
      chatId: string;
      connectionId: string | null;
      presetId?: string;
      lorebookIds?: string[];
      userMessage?: string;
      regenerateMessageId?: string;
      continueMessageId?: string;
      impersonate?: boolean;
      autonomous?: boolean;
      autonomousIntentKey?: string;
      attachments?: Array<{ type: string; data: string; filename?: string; name?: string }>;
      mentionedCharacterNames?: string[];
      forCharacterId?: string;
      skipPresenceDelay?: boolean;
      narrativeDirectorMode?: "natural" | "random";
      generationGuide?: string;
      generationGuideSource?: "narrator" | "guide" | "game_start";
      agentInjectionOverrides?: Array<{ agentType: string; agentName?: string; text: string }>;
      impersonatePresetId?: string;
      impersonateConnectionId?: string;
      impersonateBlockAgents?: boolean;
      impersonatePromptTemplate?: string;
      /** When true, this generation drives the active turn-game's bot seats instead of a chat reply. */
      turnGameBots?: boolean;
      /** Structured Roleplay/Game movement committed atomically with this owner turn. */
      pendingSpatialTransition?: PendingSpatialTransition;
    }) => {
      // Prevent concurrent generations for the same chat. Different chats may
      // keep generating in the background while the user navigates elsewhere.
      // Uses the shared abortControllers map as the source of truth so ALL callers
      // of useGenerate() coordinate (the old per-instance useRef could diverge).
      const generationState = useChatStore.getState();
      const existingGenerationIsIllustrationOnly = generationState.backgroundIllustrationChatIds.has(params.chatId);
      if (
        isGenerationStartBlocked({
          setupLocked: activeGenerateLocks.has(params.chatId),
          activeController: generationState.abortControllers.has(params.chatId),
          backgroundIllustration: existingGenerationIsIllustrationOnly,
        })
      ) {
        console.warn("[Generate] Skipped — generation already in progress for this chat");
        return false;
      }
      activeGenerateLocks.add(params.chatId);

      // Create an AbortController so the stop button can cancel this generation.
      const abortController = new AbortController();
      try {
        useChatStore.getState().setAbortController(params.chatId, abortController);
        useChatStore.getState().setBackgroundIllustration(params.chatId, false);
      } finally {
        activeGenerateLocks.delete(params.chatId);
      }
      useChatStore.getState().clearThinkingBuffer(params.chatId);

      // Helper: returns true when this generation's chat is the one the user is viewing.
      // Used to guard global UI state updates (typing indicator, delayed info, stream
      // buffer, etc.) so that a background chat's events don't corrupt the active view.
      const isActiveChat = () => useChatStore.getState().activeChatId === params.chatId;
      const isGameGeneration = getCachedChatMode(qc, params.chatId) === "game";
      const shouldRefreshGameState = shouldRefreshGameStateAfterGeneration(qc, params.chatId);
      let spriteChangeReceived = false;

      // Only touch global streaming UI state if the user is viewing this chat.
      // Background generations (e.g. autonomous messaging) run silently,
      // tracked only by abortControllers.
      if (isActiveChat()) {
        setStreaming(true, params.chatId);
        clearStreamBuffer(params.chatId);
        clearThoughtBubbles();
        clearCyoaChoices();
        clearMariChips();
        clearMariPlan();
        clearFailedAgentTypes(params.chatId);
        setRegenerateMessageId(params.regenerateMessageId ?? null);
      }
      if (useUIStore.getState().debugMode) {
        console.warn("[Generate] Starting generation for chat:", params.chatId);
      }

      // A stale in-flight message refetch can overwrite the saved assistant
      // message after it is upserted into the cache. Cancel early so the
      // post-save refresh owns the query lifecycle for this generation.
      await qc.cancelQueries({ queryKey: chatKeys.messages(params.chatId), exact: true });
      const assistantMessagesBeforeGeneration = snapshotMessagesByRole(qc, params.chatId, "assistant");
      const expectedPersistedRole: Message["role"] = params.impersonate ? "user" : "assistant";
      const expectedMessagesBeforeGeneration =
        expectedPersistedRole === "assistant"
          ? assistantMessagesBeforeGeneration
          : snapshotMessagesByRole(qc, params.chatId, expectedPersistedRole);
      if (params.regenerateMessageId) {
        forgetRecentMessageContentEdit(params.chatId, params.regenerateMessageId);
      }

      const pendingAttachments = params.attachments ?? [];

      // Optimistically show the user message in the chat immediately
      if ((params.userMessage || pendingAttachments.length > 0 || params.pendingSpatialTransition) && !params.impersonate) {
        // Build persona snapshot for per-message persona tracking
        const cachedPersonas = qc.getQueryData<
          Array<{
            id: string;
            isActive: string | boolean;
            name: string;
            description?: string;
            personality?: string;
            scenario?: string;
            backstory?: string;
            appearance?: string;
            avatarPath?: string | null;
            avatarCrop?: string;
            nameColor?: string;
            dialogueColor?: string;
            boxColor?: string;
          }>
        >(characterKeys.personas);
        const activeChat =
          qc.getQueryData<any>(chatKeys.detail(params.chatId)) ??
          (qc.getQueryData<any[]>(chatKeys.list()) ?? []).find((c: any) => c.id === params.chatId);
        const chatPersonaId = activeChat?.personaId as string | null | undefined;
        // Roleplay may intentionally have no Persona. Keep optimistic snapshot
        // stamping identical to the server's Conversation-only fallback policy.
        const snapshotPersona = cachedPersonas
          ? resolveChatPersonaCandidate(cachedPersonas, chatPersonaId, activeChat?.mode)
          : null;
        const personaSnapshot = snapshotPersona
          ? {
              personaId: snapshotPersona.id,
              name: snapshotPersona.name,
              description: snapshotPersona.description || "",
              personality: snapshotPersona.personality || "",
              scenario: snapshotPersona.scenario || "",
              backstory: snapshotPersona.backstory || "",
              appearance: snapshotPersona.appearance || "",
              avatarUrl: snapshotPersona.avatarPath || null,
              avatarCrop: snapshotPersona.avatarCrop || null,
              nameColor: snapshotPersona.nameColor || null,
              dialogueColor: snapshotPersona.dialogueColor || null,
              boxColor: snapshotPersona.boxColor || null,
            }
          : null;

        const optimisticMsg: Message = {
          id: `__optimistic_${Date.now()}`,
          chatId: params.chatId,
          role: "user",
          characterId: null,
          content: params.userMessage ?? "",
          activeSwipeIndex: 0,
          extra: {
            displayText: null,
            isGenerated: false,
            tokenCount: null,
            generationInfo: null,
            personaSnapshot,
            ...(pendingAttachments.length ? { attachments: pendingAttachments } : {}),
          },
          createdAt: new Date().toISOString(),
        };
        qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(params.chatId), (old) => {
          if (!old?.pages) return old;
          const pages = [...old.pages];
          // First page holds newest messages; merge and re-sort to guarantee order.
          pages[0] = sortMessagesByCreatedAt([...(pages[0] ?? []), optimisticMsg]);
          return { ...old, pages };
        });
        requestChatScrollToBottom({ chatId: params.chatId, behavior: "auto" });
      }

      // ── SillyTavern-style smooth streaming ──
      // Tokens arrive in bursts from the server. Instead of dumping them
      // immediately, we feed them character-by-character from a queue
      // at a controlled rate so the text "types out" smoothly.
      // Speed is controlled by the user's streamingSpeed setting (1–100).
      const transportStreaming = useUIStore.getState().enableStreaming;
      const streamingEnabled = transportStreaming;
      const chatModeForGeneration = getCachedChatMode(qc, params.chatId);
      const shouldDisplayRawStream =
        chatModeForGeneration !== "conversation" || !!params.regenerateMessageId || !!params.continueMessageId;
      const keepStreamLiveThroughPostProcessing = shouldKeepStreamLiveThroughPostProcessing({
        streamingEnabled,
        shouldDisplayRawStream,
        isGameGeneration,
        isRegeneration: !!params.regenerateMessageId,
        isContinuation: !!params.continueMessageId,
      });
      const leadingSpeakerPrefixFilter = createLeadingSpeakerPrefixFilter([
        ...getCachedChatSpeakerNames(qc, params.chatId),
        ...(params.mentionedCharacterNames ?? []),
      ]);
      let fullBuffer = ""; // What the user sees (or accumulates silently when streaming is off)
      let pendingText = ""; // Tokens waiting to be typed out
      let lastVisibleChunkAt = 0;
      let observedArrivalCharsPerSecond: number | null = null;
      let receivedContent = false; // Whether any actual message content was received
      let receivedThinking = false; // Whether provider-native thinking chunks were received
      let gameTurnLoadedSoundPlayed = false;
      let sawDoneEvent = false;
      let illustrationQueued = false;
      let illustrationSettled = false;
      let passiveStreamRecovered = false;
      let spatialTransitionCommitted = false;
      let passiveStreamSettled = false;
      let passiveRecoveryDurableMessage: Message | null = null;
      let typingActive = false;
      let typewriterDone: (() => void) | null = null;
      let rafId = 0;
      const persistedMessages = new Map<string, Message>();
      let sawGroupTurn = false;
      let currentGroupTurnSavedMessage: Message | null = null;
      let heldTextRewriteMessage: Message | null = null;
      let holdingTextRewrite = false;
      let gameStatePatchAnchor: { messageId: string; swipeIndex: number } | null = null;
      const normalizeLineBreakSpacing = (text: string) =>
        chatModeForGeneration === "roleplay" ? text.replace(/[ \t]+(\r?\n)/g, "$1") : text;
      const rememberContinuedMessageContent = (message: Message) => {
        if (!params.continueMessageId || message.id !== params.continueMessageId) return;
        const swipeIndex =
          typeof message.activeSwipeIndex === "number" && Number.isInteger(message.activeSwipeIndex)
            ? message.activeSwipeIndex
            : null;
        rememberRecentMessageContentEdit(params.chatId, message.id, message.content, swipeIndex);
      };
      const appendVisibleGeneratedChunk = (chunk: string) => {
        const normalizedChunk = normalizeLineBreakSpacing(chunk);
        if (/^\r?\n/.test(normalizedChunk)) {
          fullBuffer = fullBuffer.replace(/[ \t]+$/, "");
          pendingText = pendingText.replace(/[ \t]+$/, "");
        }
        if (!normalizedChunk) return;
        if (streamingEnabled && shouldDisplayRawStream) {
          const now = performance.now();
          if (lastVisibleChunkAt > 0) {
            const elapsedMs = now - lastVisibleChunkAt;
            if (elapsedMs >= 16 && elapsedMs <= 5000) {
              const sampleRate = (normalizedChunk.length * 1000) / elapsedMs;
              observedArrivalCharsPerSecond =
                observedArrivalCharsPerSecond === null
                  ? sampleRate
                  : observedArrivalCharsPerSecond * 0.5 + sampleRate * 0.5;
            }
          }
          lastVisibleChunkAt = now;
          pendingText += normalizedChunk;
          startTypewriter();
        } else {
          fullBuffer = normalizeLineBreakSpacing(fullBuffer + normalizedChunk);
        }
      };
      const flushLeadingSpeakerPrefix = () => {
        const heldPrefix = leadingSpeakerPrefixFilter.flush();
        if (heldPrefix) appendVisibleGeneratedChunk(heldPrefix);
      };
      const appendGeneratedChunk = (chunk: string) => {
        const visibleChunk = leadingSpeakerPrefixFilter.push(chunk);
        if (visibleChunk) appendVisibleGeneratedChunk(visibleChunk);
      };

      // ── Streaming think-tag filter ──
      // Inline reasoning tags are suppressed during streaming so raw markers
      // never flash in the message before the server sends final cleanup.
      const thinkingStreamFilter = createInlineThinkingStreamFilter(
        streamingEnabled ? resolveCachedCustomThinkingTags(qc, params.chatId, params.connectionId) : [],
      );
      const flushThinkingStreamFilter = () => {
        const flushed = thinkingStreamFilter.flush();
        if (flushed.thinking) appendThinkingBuffer(flushed.thinking, params.chatId);
        if (flushed.visible) appendGeneratedChunk(flushed.visible);
      };

      // Compute visible characters per second from the user's streamingSpeed setting (1–100).
      // Read per-tick so changes to the slider take effect immediately.
      // speed 1   → slow read-along reveal
      // speed 30  → deliberate typewriter pace
      // speed 100 → flush instantly
      const getCharsPerSecond = () => {
        const speed = useUIStore.getState().streamingSpeed;
        if (speed >= 100) return Infinity;
        const normalized = Math.max(0, Math.min(1, (speed - 1) / 98));
        return 12 + Math.pow(normalized, 1.65) * 248;
      };
      const getMaxCharsPerTypewriterFrame = (charsPerSecond: number) => {
        if (charsPerSecond === Infinity) return Infinity;
        return Math.max(1, Math.ceil(charsPerSecond / 60));
      };

      const TYPEWRITER_MAX_FRAME_MS = 120;
      let lastTypewriterPaintAt = 0;
      let typewriterRemainder = 0;
      const canInspectPageFocus = typeof document !== "undefined";
      let pageWasHiddenDuringStream = canInspectPageFocus && document.visibilityState !== "visible";

      const flushTypewriterBuffer = () => {
        cancelAnimationFrame(rafId);
        fullBuffer = normalizeLineBreakSpacing(fullBuffer + pendingText);
        pendingText = "";
        typingActive = false;
        typewriterRemainder = 0;
        lastTypewriterPaintAt = 0;
        if (streamingEnabled && shouldDisplayRawStream && fullBuffer) setStreamBuffer(fullBuffer, params.chatId);
        if (typewriterDone) {
          const done = typewriterDone;
          typewriterDone = null;
          done();
        }
      };

      const replaceGeneratedContentWithTypewriter = (content: string, options: { retype?: boolean } = {}) => {
        const nextContent = normalizeLineBreakSpacing(content);
        cancelAnimationFrame(rafId);
        typingActive = false;
        typewriterRemainder = 0;
        lastTypewriterPaintAt = 0;

        if (!streamingEnabled || !shouldDisplayRawStream) {
          fullBuffer = nextContent;
          pendingText = "";
          return;
        }

        const reconciled = reconcileTypewriterReplacement(fullBuffer, nextContent, options.retype === true);
        fullBuffer = reconciled.visibleText;
        pendingText = reconciled.pendingText;

        if (pendingText) {
          startTypewriter();
        } else {
          setStreamBuffer(fullBuffer, params.chatId);
          if (typewriterDone) {
            const done = typewriterDone;
            typewriterDone = null;
            done();
          }
        }
      };

      const startTypewriter = () => {
        if (typingActive) return;
        typingActive = true;
        const tick = (now = performance.now()) => {
          if (pendingText.length === 0) {
            typingActive = false;
            lastTypewriterPaintAt = 0;
            if (typewriterDone) {
              typewriterDone();
              typewriterDone = null;
            }
            return;
          }
          if (!lastTypewriterPaintAt) lastTypewriterPaintAt = now;
          const elapsedMs = Math.min(TYPEWRITER_MAX_FRAME_MS, Math.max(0, now - lastTypewriterPaintAt));
          lastTypewriterPaintAt = now;

          const charsPerSecond = getTypewriterRevealCharsPerSecond({
            selectedCharsPerSecond: getCharsPerSecond(),
            pendingCharacters: pendingText.length,
            observedArrivalCharsPerSecond,
            streamComplete: sawDoneEvent,
          });
          if (charsPerSecond === Infinity) {
            fullBuffer += pendingText;
            pendingText = "";
            setStreamBuffer(fullBuffer, params.chatId);
            rafId = requestAnimationFrame(tick);
            return;
          }

          typewriterRemainder += (charsPerSecond * elapsedMs) / 1000;
          const maxCharsThisFrame = getMaxCharsPerTypewriterFrame(charsPerSecond);
          const n = Math.min(Math.floor(typewriterRemainder), maxCharsThisFrame, pendingText.length);
          if (n < 1) {
            rafId = requestAnimationFrame(tick);
            return;
          }
          typewriterRemainder -= n;
          const batch = pendingText.slice(0, n);
          pendingText = pendingText.slice(n);
          fullBuffer += batch;
          setStreamBuffer(fullBuffer, params.chatId);
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      };
      const markPageHidden = () => {
        pageWasHiddenDuringStream = true;
      };
      const recordBackgroundedStream = () => {
        if (document.visibilityState === "visible") return;
        markPageHidden();
        // Browsers pause requestAnimationFrame in background tabs. Finish the
        // queued text immediately so post-processing cannot wait indefinitely.
        if (pendingText.length > 0 || typingActive) flushTypewriterBuffer();
      };
      if (canInspectPageFocus) {
        document.addEventListener("visibilitychange", recordBackgroundedStream);
        window.addEventListener("pagehide", markPageHidden);
      }

      const waitForTypewriterDrain = async () => {
        if (!streamingEnabled || !shouldDisplayRawStream || (pendingText.length === 0 && !typingActive)) return;
        if (canInspectPageFocus && document.visibilityState !== "visible") {
          recordBackgroundedStream();
          return;
        }
        await new Promise<void>((resolve) => {
          if (pendingText.length === 0 && !typingActive) {
            resolve();
            return;
          }
          typewriterDone = resolve;
          startTypewriter();
        });
      };
      const canRefreshCurrentMessagesNow = () => {
        if (!streamingEnabled || !shouldDisplayRawStream) return true;
        const streamState = useChatStore.getState();
        return streamState.streamingChatId !== params.chatId || streamState.committedStreamChatIds.has(params.chatId);
      };
      const invalidateCurrentMessagesIfSafe = () => {
        if (!canRefreshCurrentMessagesNow()) return false;
        qc.invalidateQueries({ queryKey: chatKeys.messages(params.chatId) });
        return true;
      };

      // Safety net: guarantees the Mari work-status pill clears for this
      // chat on every termination path (done, error, abort, unexpected
      // throw). The assistant_commands_end SSE event is still the primary
      // clear; this just keeps state sane when the stream dies mid-window.
      const clearMariPhaseForThisChat = () => {
        setMariPhase(params.chatId, "idle");
        window.dispatchEvent(
          new CustomEvent("marinara:mari-phase", {
            detail: { chatId: params.chatId, phase: "idle" },
          }),
        );
      };

      try {
        const {
          userStatus,
          userActivity,
          debugMode,
          trimIncompleteModelOutput,
          musicPlayerEnabled,
          musicPlayerSource,
        } = useUIStore.getState();
        const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";

        // Flush any pending game-state widget edits so the server sees them before committing
        const flushPatch = useGameStateStore.getState().flushPatch;
        if (flushPatch) await flushPatch();

        await waitForPendingChatMetadataSaves(params.chatId);
        const currentBackground = getActiveChatBackgroundForGeneration(params.chatId);

        for await (const event of api.streamEvents(
          "/generate",
          {
            ...params,
            ...(currentBackground !== undefined ? { currentBackground } : {}),
            userStatus,
            userActivity,
            userTimeZone,
            debugMode,
            trimIncompleteModelOutput,
            musicPlayerEnabled,
            musicPlayerSource,
            streaming: transportStreaming,
          },
          abortController.signal,
          // Backgrounded tabs can leave the stream socket half-open; treat a
          // resume as a disconnect so the passive-recovery path refetches the
          // reply the server finished while we were away instead of hanging.
          { disconnectOnResume: true },
        )) {
          switch (event.type) {
            case "spatial_transition_committed": {
              const transitionData = event.data as
                | { chatId?: string; commandId?: string; currentLocationId?: string; definitionRevision?: number }
                | undefined;
              if (transitionData?.chatId === params.chatId && transitionData.commandId) {
                spatialTransitionCommitted = true;
                useChatStore
                  .getState()
                  .clearPendingSpatialTransition(params.chatId, transitionData.commandId);
                void qc.invalidateQueries({ queryKey: spatialContextKeys.detail(params.chatId) });
                void qc.invalidateQueries({ queryKey: chatKeys.detail(params.chatId) });
              }
              break;
            }

            case "token": {
              const isFirstToken = !receivedContent;
              receivedContent = true;
              // Always clear per-chat indicators so switching back shows nothing
              useChatStore.getState().setPerChatTyping(params.chatId, null);
              useChatStore.getState().setPerChatDelayed(params.chatId, null);
              if (isActiveChat()) {
                setTypingCharacterName(null); // Clear typing indicator once response starts
                setDelayedCharacterInfo(null); // Clear delayed indicator too
                useChatStore.getState().setGenerationPhase(null); // Clear phase indicator
              }
              // Fire the "Mari is thinking…" pill on the first token — that's
              // the same moment "X is typing…" clears, so the two indicators
              // never overlap. Also seed the per-chat phase in the store so
              // the indicator can restore the pill on chat-switch-back.
              if (isFirstToken) {
                setMariPhase(params.chatId, "thinking");
                window.dispatchEvent(
                  new CustomEvent("marinara:mari-phase", {
                    detail: { chatId: params.chatId, phase: "thinking" },
                  }),
                );
              }

              let chunk = event.data as string;

              // ── Think-tag streaming filter ──
              if (streamingEnabled) {
                const filtered = thinkingStreamFilter.push(chunk);
                if (filtered.thinking) appendThinkingBuffer(filtered.thinking, params.chatId);
                chunk = filtered.visible;
              }

              if (!chunk) break;

              appendGeneratedChunk(chunk);
              break;
            }

            case "agent_start": {
              setProcessing(true, params.chatId);
              break;
            }

            case "agent_warning": {
              showAgentWarning(event.data, params.chatId);
              break;
            }

            case "agent_injection_review": {
              window.dispatchEvent(
                new CustomEvent("marinara:agent-injection-review", {
                  detail: event.data,
                }),
              );
              break;
            }

            case "progress": {
              if (!isActiveChat()) break;
              const phase = (event.data as { phase?: string })?.phase;
              const labels: Record<string, string> = {
                embedding: "Preparing context...",
                assembling: "Building prompt...",
                lorebooks: "Scanning lorebooks...",
                memory_recall: "Recalling memories...",
                agents: "Running agents...",
                knowledge_retrieval: "Retrieving knowledge...",
                generating: "Generating...",
              };
              const label = phase ? (labels[phase] ?? null) : null;
              if (label) {
                useChatStore.getState().setGenerationPhase(label);
              }
              break;
            }

            case "agent_result": {
              const result = event.data as {
                agentType: string;
                agentName: string;
                resultType: string;
                data: unknown;
                tokensUsed?: number;
                success: boolean;
                error: string | null;
                durationMs: number;
              };

              if (debugMode) {
                if (result.success) {
                  console.warn(
                    `[Agent] ✓ ${result.agentName} (${result.agentType}) — ${(result.durationMs / 1000).toFixed(1)}s`,
                    result.data,
                  );
                } else {
                  console.warn(
                    `[Agent] ✗ ${result.agentName} (${result.agentType}) — ${result.error ?? "unknown error"}`,
                    result.data,
                  );
                }
              }

              if (result.success) {
                qc.invalidateQueries({ queryKey: agentKeys.customRuns(params.chatId) });
                if (result.resultType === "sprite_change") {
                  spriteChangeReceived = true;
                  invalidateCurrentMessagesIfSafe();
                }
                if (result.resultType === "spotify_control") {
                  qc.invalidateQueries({ queryKey: ["spotify", "player"] });
                }
              }

              const writeApproval = result.success
                ? readAgentWriteApprovalProposal(result.data, {
                    chatId: params.chatId,
                    agentType: result.agentType,
                    agentName: result.agentName,
                  })
                : null;
              if (writeApproval) {
                enqueuePendingAgentWriteApproval(createPendingAgentWriteApproval(writeApproval));
                if (isActiveChat()) useUIStore.getState().openModal("agent-write-approval");
              }

              // Only update agent/game/UI stores for the active chat so a
              // background generation doesn't corrupt what the user sees.
              if (!isActiveChat()) break;

              // Store the result
              addResult(result.agentType, {
                agentId: result.agentType,
                agentType: result.agentType,
                type: result.resultType as any,
                data: result.data,
                tokensUsed: result.tokensUsed ?? 0,
                durationMs: result.durationMs,
                success: result.success,
                error: result.error,
              });

              const bubble = result.success ? formatAgentBubble(result.agentType, result.agentName, result.data) : null;
              if (bubble) {
                addThoughtBubble(result.agentType, result.agentName, bubble);
              }

              // Apply successful informational agent data to dedicated stores.
              if (result.success && result.data) {
                // Push echo-chamber reactions to the dedicated echo store
                if (result.agentType === "echo-chamber") {
                  const d = result.data as Record<string, unknown>;
                  const reactions = (d.reactions as Array<{ characterName: string; reaction: string }>) ?? [];
                  enqueueEchoMessages(reactions);
                }

                // Push CYOA choices to the dedicated store
                if (result.agentType === "cyoa") {
                  const d = result.data as Record<string, unknown>;
                  const choices = (d.choices as Array<{ label: string; text: string }>) ?? [];
                  if (choices.length > 0) {
                    setCyoaChoices(choices, params.chatId);
                  }
                }

                // Drive the embedded YouTube player from the agent's intent.
                if (result.resultType === "youtube_control") {
                  const d = result.data as Record<string, unknown>;
                  const action = d.action as string;
                  if (typeof d.volume === "number" && Number.isFinite(d.volume)) {
                    setYoutubeVolume(Math.max(0, Math.min(100, d.volume)));
                  }
                  if (action === "play" && typeof d.searchQuery === "string" && d.searchQuery.trim()) {
                    setYoutubePlay({ searchQuery: d.searchQuery.trim(), mood: (d.mood as string) ?? "" });
                  }
                }

                // Drive the embedded Custom local player from the agent's exact asset pick.
                if (result.resultType === "local_music_control") {
                  const d = result.data as Record<string, unknown>;
                  const action = d.action as string;
                  if (typeof d.volume === "number" && Number.isFinite(d.volume)) {
                    setLocalMusicVolume(Math.max(0, Math.min(100, d.volume)));
                  }
                  const path = typeof d.path === "string" ? d.path.trim() : "";
                  if (action === "play" && path) {
                    const trackName = typeof d.trackName === "string" ? d.trackName.trim() : "";
                    const fallbackTitle =
                      path
                        .split("/")
                        .pop()
                        ?.replace(/\.[^.]+$/, "")
                        .replace(/[-_]+/g, " ") || "Local track";
                    setLocalMusicPlay({
                      path,
                      title: trackName || fallbackTitle,
                      mood: (d.mood as string) ?? "",
                    });
                  }
                }
              }

              // Character card updates are never applied automatically — enqueue
              // them for the user-approval modal. (Card Evolution Auditor.)
              if (result.success && result.resultType === "character_card_update") {
                buildPendingCardUpdates(qc, params.chatId, result.agentType, result.agentName, result.data)
                  .then((pendingEntries) => {
                    if (pendingEntries.length > 0) {
                      for (const pending of pendingEntries) {
                        enqueuePendingCardUpdate(pending);
                      }
                      useUIStore.getState().openModal("character-card-update");
                    }
                  })
                  .catch((err) => console.warn("[Agent] Failed to build card update entry:", err));
              }

              // Apply background change — validate the resolved background URL before applying
              if (result.success && result.resultType === "background_change" && result.data) {
                const bg = result.data as { chosen?: string | null; generated?: boolean };
                if (bg.chosen) {
                  applyAgentBackgroundChoice(bg.chosen);
                }
                if (bg.generated) {
                  qc.invalidateQueries({ queryKey: ["backgrounds"] });
                }
              }

              if (result.success && result.resultType === "frontend_theme_update" && result.data) {
                applyAgentFrontendStyle(params.chatId, result.data);
              }

              // Apply quest updates directly so the widget updates immediately
              if (result.success && result.agentType === "quest" && result.data) {
                const qd = result.data as Record<string, unknown>;
                const updates = Array.isArray(qd.updates) ? qd.updates : [];
                if (debugMode) {
                  console.warn(`[Agent] Quest data:`, qd);
                  console.warn(`[Agent] Quest updates: ${updates.length} update(s)`, updates);
                }
                if (updates.length > 0) {
                  const cur = useGameStateStore.getState().current;
                  if (debugMode) console.warn(`[Agent] Quest merge — current gameState:`, cur);
                  const existing = cur?.playerStats ?? {
                    stats: [],
                    attributes: null,
                    skills: {},
                    inventory: [],
                    activeQuests: [],
                    status: "",
                  };
                  const questMerge = applyQuestUpdatesToPlayerStats(existing, updates);
                  const quests = questMerge.quests;
                  if (debugMode) console.warn(`[Agent] Quest merge result — activeQuests:`, quests);
                  applyGameStatePatchToStore(params.chatId, { playerStats: questMerge.playerStats });
                } else if (debugMode) {
                  console.warn(`[Agent] Quest agent returned success but 0 updates — data shape:`, Object.keys(qd));
                }
              }
              break;
            }

            case "agent_debug": {
              if (!debugMode) break;
              addDebugEntry({
                phase: "agent_call",
                agentCall: event.data as AgentCallDebugEvent,
              });
              break;
            }

            case "tool_call": {
              if (!debugMode) break;
              const data = event.data as { name?: unknown; arguments?: unknown; allowed?: unknown };
              addDebugEntry({
                phase: "tool_call",
                toolCall: {
                  name: typeof data.name === "string" ? data.name : "unknown_tool",
                  arguments: formatToolDebugPayload(data.arguments),
                  allowed: data.allowed !== false,
                },
              });
              break;
            }

            case "tool_result": {
              if (!debugMode) break;
              const data = event.data as { name?: unknown; result?: unknown; success?: unknown };
              addDebugEntry({
                phase: "tool_result",
                toolResult: {
                  name: typeof data.name === "string" ? data.name : "unknown_tool",
                  result: formatToolDebugPayload(data.result),
                  success: data.success === true,
                },
              });
              break;
            }

            case "thinking": {
              const chunk = event.data as string;
              if (!chunk) break;
              const isFirstThinking = !receivedThinking;
              receivedThinking = true;
              appendThinkingBuffer(chunk, params.chatId);
              if (isFirstThinking && isActiveChat()) {
                setTypingCharacterName(null);
                setDelayedCharacterInfo(null);
                useChatStore.getState().setGenerationPhase(null);
                setMariPhase(params.chatId, "thinking");
                window.dispatchEvent(
                  new CustomEvent("marinara:mari-phase", {
                    detail: { chatId: params.chatId, phase: "thinking" },
                  }),
                );
              }
              break;
            }

            case "group_turn": {
              const turn = event.data as { characterId: string; characterName: string; index: number };
              sawGroupTurn = true;
              leadingSpeakerPrefixFilter.addLabels([turn.characterName]);

              // If this isn't the first character, flush the previous one's content
              if (turn.index > 0) {
                flushLeadingSpeakerPrefix();
                // Drain typewriter for the previous character (only if streaming)
                await waitForTypewriterDrain();
                const previousGroupMessage = currentGroupTurnSavedMessage;

                // Pick up the just-saved message from the previous character
                await refreshMessagesAuthoritatively(qc, params.chatId, persistedMessages.values());
                // Increment unread if user navigated away during group generation
                const activeNow = useChatStore.getState().activeChatId;
                if (previousGroupMessage && activeNow !== params.chatId) {
                  useChatStore.getState().incrementUnread(params.chatId);
                  const identity = resolveCachedCharacterIdentity(
                    qc,
                    previousGroupMessage?.characterId ?? null,
                    (previousGroupMessage as (Message & { characterName?: string | null }) | null)?.characterName ??
                      null,
                  );
                  useChatStore
                    .getState()
                    .addNotification(
                      params.chatId,
                      identity.name ?? "Character",
                      identity.avatarUrl,
                      identity.avatarCrop,
                    );
                  const chatList = qc.getQueryData<Chat[]>(chatKeys.list());
                  const thisChat = chatList?.find((c) => c.id === params.chatId);
                  const isRpMode = thisChat?.mode === "roleplay" || thisChat?.mode === "visual_novel";
                  const soundOn = isRpMode
                    ? useUIStore.getState().rpNotificationSound
                    : useUIStore.getState().convoNotificationSound;
                  playConfiguredNotificationPing(
                    soundOn && !messageHasPendingPostProcessing(previousGroupMessage),
                    useUIStore.getState().notificationSoundsOnlyWhenUnfocused,
                  );
                }
                // Reset the stream buffer for the new character
                fullBuffer = "";
                pendingText = "";
                leadingSpeakerPrefixFilter.reset();
                thinkingStreamFilter.reset();
                setStreamBuffer("", params.chatId);
                clearThinkingBuffer(params.chatId);
                // Reveal the previous member's durable row only after its live
                // presentation buffers are fully cleared.
                setStreamedMessageId(params.chatId, null);
              } else {
                setStreamedMessageId(params.chatId, null);
              }
              currentGroupTurnSavedMessage = null;

              if (streamingEnabled) setStreamCommitted(params.chatId, false);
              if (isActiveChat()) setStreamingCharacterId(turn.characterId);
              break;
            }

            case "response_queue": {
              const data = event.data as { characterIds?: unknown; characters?: Array<{ id?: unknown }> };
              const rawIds = Array.isArray(data.characterIds)
                ? data.characterIds
                : Array.isArray(data.characters)
                  ? data.characters.map((character) => character.id)
                  : [];
              const characterIds = rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
              setResponseQueue(params.chatId, characterIds);
              break;
            }

            case "response_queue_failed": {
              clearResponseQueue(params.chatId);
              if (isActiveChat()) toast.warning("No response queue was created. Try triggering the response again.");
              break;
            }

            case "game_state":
            case "game_state_patch": {
              const patch = event.data as Record<string, unknown>;
              if (debugMode) console.warn(`[Generate] ${event.type} received:`, patch);
              if (!isActiveChat()) break;
              discardPendingGameStatePatch(params.chatId);
              applyGameStatePatchToStore(params.chatId, patch, gameStatePatchAnchor);
              break;
            }

            case "turn_game_state_patch": {
              const turnGameType = (event.data as { gameType?: string } | null)?.gameType;
              if (turnGameType) {
                dispatchCapabilityClientEvent({
                  packageId: turnGameType,
                  type: event.type,
                  chatId: params.chatId,
                  data: event.data,
                });
              }
              break;
            }

            case "game_map_update": {
              const map = event.data as GameMap | null;
              if (map) applyGameMapUpdate(qc, params.chatId, map);
              break;
            }

            case "chat_summary": {
              // Refresh the chat detail so the summary popover picks up the new value
              qc.invalidateQueries({ queryKey: chatKeys.detail(params.chatId) });
              // When the server auto-hid summarized messages (opt-in token compression),
              // refresh the message list so their hidden state shows in the UI.
              const summaryData = event.data as { hiddenMessageIds?: unknown };
              if (Array.isArray(summaryData.hiddenMessageIds) && summaryData.hiddenMessageIds.length > 0) {
                invalidateCurrentMessagesIfSafe();
              }
              break;
            }

            case "agent_write_proposal": {
              const proposal = readAgentWriteApprovalProposal(event.data, { chatId: params.chatId });
              if (proposal) {
                enqueuePendingAgentWriteApproval(createPendingAgentWriteApproval(proposal));
                if (isActiveChat()) useUIStore.getState().openModal("agent-write-approval");
              }
              break;
            }

            case "metadata_patch": {
              qc.invalidateQueries({ queryKey: chatKeys.detail(params.chatId) });
              qc.invalidateQueries({ queryKey: lorebookKeys.active(params.chatId) });
              break;
            }

            case "text_rewrite": {
              // A post-processing editor replaced the message — update displayed text.
              const rw = event.data as {
                editedText?: string;
                changes?: Array<{ description: string }>;
                rewriteApplied?: boolean;
                originalText?: string;
                agentType?: string;
              };
              if (rw.editedText) {
                const rewrittenText = normalizeLineBreakSpacing(rw.editedText);
                const builtInRewriteApplied =
                  rw.rewriteApplied === true &&
                  (rw.agentType === "prose-guardian" || rw.agentType === "continuity" || rw.agentType === "html") &&
                  typeof rw.originalText === "string";
                leadingSpeakerPrefixFilter.discard();
                if (holdingTextRewrite && heldTextRewriteMessage) {
                  thinkingStreamFilter.reset();
                  const textRewriteUsesLiveStream =
                    streamingEnabled &&
                    shouldDisplayRawStream &&
                    !useChatStore.getState().committedStreamChatIds.has(params.chatId);
                  if (textRewriteUsesLiveStream) {
                    replaceGeneratedContentWithTypewriter(rewrittenText, { retype: rw.rewriteApplied === true });
                    await waitForTypewriterDrain();
                  } else {
                    fullBuffer = rewrittenText;
                    pendingText = "";
                    if (!useChatStore.getState().committedStreamChatIds.has(params.chatId)) {
                      setStreamBuffer(fullBuffer, params.chatId);
                    }
                  }
                  const heldExtra = { ...parseMessageExtraRecord(heldTextRewriteMessage.extra) };
                  delete heldExtra.postProcessingPending;
                  if (builtInRewriteApplied) {
                    heldExtra.proseGuardianOriginalText = rw.originalText;
                    heldExtra.proseGuardianRewrittenText = rewrittenText;
                    heldExtra.proseGuardianRewrittenAt = new Date().toISOString();
                  } else {
                    delete heldExtra.proseGuardianOriginalText;
                    delete heldExtra.proseGuardianRewrittenText;
                    delete heldExtra.proseGuardianRewrittenAt;
                  }
                  const updatedMessage = {
                    ...heldTextRewriteMessage,
                    content: rewrittenText,
                    extra: heldExtra as unknown as Message["extra"],
                  };
                  rememberContinuedMessageContent(updatedMessage);
                  persistedMessages.set(updatedMessage.id, updatedMessage);
                  if (currentGroupTurnSavedMessage?.id === updatedMessage.id) {
                    currentGroupTurnSavedMessage = updatedMessage;
                  }
                  // Keep the final rewritten text as the live stream until the
                  // full generation lifecycle finishes. The durable row is
                  // primed during final cleanup so there is no full-text flash.
                  holdingTextRewrite = false;
                  heldTextRewriteMessage = null;
                  break;
                }

                if (streamingEnabled && (pendingText.length > 0 || typingActive)) {
                  cancelAnimationFrame(rafId);
                  pendingText = "";
                  typingActive = false;
                }
                fullBuffer = rewrittenText;
                if (streamingEnabled && shouldDisplayRawStream) setStreamBuffer(fullBuffer, params.chatId);
                if (useChatStore.getState().committedStreamChatIds.has(params.chatId)) {
                  const latestSavedMessage = latestAssistantMessage(persistedMessages.values());
                  if (latestSavedMessage) {
                    const nextExtra = { ...parseMessageExtraRecord(latestSavedMessage.extra) };
                    if (builtInRewriteApplied) {
                      nextExtra.proseGuardianOriginalText = rw.originalText;
                      nextExtra.proseGuardianRewrittenText = rewrittenText;
                      nextExtra.proseGuardianRewrittenAt = new Date().toISOString();
                    }
                    const updatedMessage = {
                      ...latestSavedMessage,
                      content: fullBuffer,
                      extra: nextExtra as unknown as Message["extra"],
                    };
                    rememberContinuedMessageContent(updatedMessage);
                    persistedMessages.set(updatedMessage.id, updatedMessage);
                    if (currentGroupTurnSavedMessage?.id === updatedMessage.id) {
                      currentGroupTurnSavedMessage = updatedMessage;
                    }
                    upsertPersistedMessages(qc, params.chatId, [updatedMessage]);
                  }
                }
              }
              break;
            }

            case "content_replace": {
              // Server stripped character commands — replace the displayed content
              leadingSpeakerPrefixFilter.discard();
              thinkingStreamFilter.reset();
              const cleanContent = event.data as string;
              replaceGeneratedContentWithTypewriter(cleanContent);
              break;
            }

            case "generation_discarded": {
              const discarded = event.data as { characterId?: unknown } | null;
              const discardedCharacterId =
                discarded && typeof discarded.characterId === "string" ? discarded.characterId : null;
              if (discardedCharacterId) {
                completeQueuedResponse(params.chatId, discardedCharacterId);
              }
              currentGroupTurnSavedMessage = null;
              receivedContent = latestAssistantMessage(persistedMessages.values()) !== null;
              replaceGeneratedContentWithTypewriter("");
              if (!params.autonomous) {
                toast.info("The model repeated its previous message, so it was not posted.");
              }
              break;
            }

            case "message_saved": {
              flushLeadingSpeakerPrefix();
              const savedMessage = event.data as Message;
              if (savedMessage.role === "assistant") {
                completeQueuedResponse(params.chatId, savedMessage.characterId);
                currentGroupTurnSavedMessage = savedMessage;
              }
              await qc.cancelQueries({ queryKey: chatKeys.messages(params.chatId), exact: true });
              persistedMessages.set(savedMessage.id, savedMessage);
              if (savedMessage.role === "assistant" && keepStreamLiveThroughPostProcessing) {
                setStreamedMessageId(params.chatId, savedMessage.id);
              }
              gameStatePatchAnchor = {
                messageId: savedMessage.id,
                swipeIndex:
                  typeof savedMessage.activeSwipeIndex === "number" && Number.isInteger(savedMessage.activeSwipeIndex)
                    ? savedMessage.activeSwipeIndex
                    : 0,
              };
              const savedExtra = parseMessageExtraRecord(savedMessage.extra);
              const pendingPostProcessing = savedExtra.postProcessingPending;
              const pendingPostProcessingAgentType =
                pendingPostProcessing &&
                typeof pendingPostProcessing === "object" &&
                !Array.isArray(pendingPostProcessing)
                  ? (pendingPostProcessing as { agentType?: unknown }).agentType
                  : null;
              if (
                savedMessage.role === "assistant" &&
                pendingPostProcessing &&
                typeof pendingPostProcessing === "object" &&
                !Array.isArray(pendingPostProcessing) &&
                (pendingPostProcessingAgentType === "prose-guardian" ||
                  pendingPostProcessingAgentType === "continuity" ||
                  pendingPostProcessingAgentType === "html" ||
                  pendingPostProcessingAgentType === "text-rewrite")
              ) {
                const heldExtra = { ...savedExtra };
                flushThinkingStreamFilter();
                flushLeadingSpeakerPrefix();
                thinkingStreamFilter.reset();
                const generatedText = normalizeLineBreakSpacing(fullBuffer + pendingText);
                const heldMessage = {
                  ...savedMessage,
                  content: generatedText || savedMessage.content,
                  extra: heldExtra as unknown as Message["extra"],
                };
                holdingTextRewrite = true;
                heldTextRewriteMessage = heldMessage;
                receivedContent = true;
                persistedMessages.set(heldMessage.id, heldMessage);
                if (!streamingEnabled || !shouldDisplayRawStream) {
                  upsertPersistedMessages(qc, params.chatId, [heldMessage]);
                }
                break;
              }
              // The server saves fresh Roleplay output before post-processing
              // agents start. Keep the live stream authoritative until `done`,
              // otherwise the complete persisted row replaces the animated
              // buffer as soon as agents begin their work.
              if (!keepStreamLiveThroughPostProcessing) {
                rememberContinuedMessageContent(savedMessage);
                upsertPersistedMessages(qc, params.chatId, [savedMessage]);
              }
              break;
            }

            case "schedule_updated": {
              break;
            }

            case "cross_post": {
              const cpData = event.data as {
                targetChatId: string;
                targetChatName: string;
                sourceChatId: string;
                characterId: string;
              };
              toast(`Message redirected to ${cpData.targetChatName}`, { icon: "↗️" });
              // Invalidate both chats: target got a new message, source had it removed
              qc.invalidateQueries({ queryKey: ["chats", "messages", cpData.targetChatId] });
              qc.invalidateQueries({ queryKey: ["chats", "messages", cpData.sourceChatId] });
              break;
            }

            case "selfie": {
              if (isActiveChat()) setTypingCharacterName(null);
              const selfieData = event.data as {
                characterId: string;
                characterName: string;
                messageId: string;
                imageUrl: string;
              };
              toast(`${selfieData.characterName} sent a selfie 📸`);
              // During streaming the real message is deferred — refreshing now
              // would insert it into the cache alongside the StreamingIndicator,
              // causing a duplicate flash. The finally block's authoritative
              // refresh will pick up the selfie attachment from DB.
              if (!streamingEnabled) {
                await refreshMessagesAuthoritatively(qc, params.chatId, persistedMessages.values());
              }
              break;
            }

            case "selfie_error": {
              if (isActiveChat()) setTypingCharacterName(null);
              const errData = event.data as { characterId: string; error: string };
              console.warn("[selfie] Generation failed:", errData.error);
              toast.error(`Selfie generation failed: ${errData.error}`);
              break;
            }

            case "conversation_call_ringing": {
              const data = event.data as {
                session?: {
                  id?: unknown;
                  chatId?: unknown;
                  initiatorCharacterId?: unknown;
                  metadata?: Record<string, unknown>;
                };
                reason?: unknown;
                characterId?: unknown;
              };
              const session = data.session;
              const callId = typeof session?.id === "string" ? session.id : null;
              const callChatId = typeof session?.chatId === "string" ? session.chatId : params.chatId;
              const characterId =
                typeof data.characterId === "string"
                  ? data.characterId
                  : typeof session?.initiatorCharacterId === "string"
                    ? session.initiatorCharacterId
                    : null;
              const reason =
                typeof data.reason === "string"
                  ? data.reason
                  : typeof session?.metadata?.reason === "string"
                    ? session.metadata.reason
                    : null;

              dispatchCapabilityClientEvent({
                packageId: "conversation-calls",
                type: event.type,
                chatId: callChatId,
                data: event.data,
              });
              if (callChatId === params.chatId) {
                invalidateCurrentMessagesIfSafe();
              } else {
                qc.invalidateQueries({ queryKey: chatKeys.messages(callChatId) });
              }
              qc.invalidateQueries({ queryKey: chatKeys.list() });

              if (callId && !isChatSurfaceVisible(callChatId)) {
                const identity = resolveCachedCharacterIdentity(qc, characterId);
                useChatStore
                  .getState()
                  .addCallNotification(
                    callChatId,
                    callId,
                    identity.name ?? "Character",
                    identity.avatarUrl,
                    identity.avatarCrop,
                    reason,
                    { showWhenActive: true },
                  );
              }
              break;
            }

            case "spotify_command": {
              const spotifyData = event.data as {
                track?: { name?: string; artist?: string };
                title?: string;
                artist?: string;
              };
              const trackName = spotifyData.track?.name ?? spotifyData.title ?? "Spotify track";
              const artistName = spotifyData.track?.artist ?? spotifyData.artist ?? "Spotify";
              toast(`Playing ${trackName} - ${artistName}`, { icon: "🎵" });
              qc.invalidateQueries({ queryKey: ["spotify", "player"] });
              break;
            }

            case "spotify_command_error": {
              const spotifyData = event.data as { title?: string; artist?: string; error?: string };
              toast.error(spotifyData.error ?? "Spotify song command failed.");
              break;
            }

            case "youtube_command": {
              const youtubeData = event.data as { searchQuery?: string; mood?: string };
              const searchQuery = youtubeData.searchQuery?.trim();
              if (searchQuery) {
                setYoutubePlay({
                  searchQuery,
                  mood: youtubeData.mood ?? "Conversation music command",
                });
                toast(`Playing YouTube: ${searchQuery}`, { icon: "▶" });
              }
              break;
            }

            case "illustration": {
              illustrationSettled = true;
              const illData = event.data as {
                messageId: string;
                imageUrl: string;
                reason?: string;
              };
              toast(illData.reason ? `🎨 ${illData.reason}` : "🎨 Scene illustration generated");
              // During streaming the real message is deferred — refreshing now
              // would insert it into the cache alongside the StreamingIndicator,
              // causing a duplicate flash. The finally block's authoritative
              // refresh will pick up the illustration attachment from DB.
              if (!streamingEnabled) {
                await refreshMessagesAuthoritatively(qc, params.chatId, persistedMessages.values());
              }
              void qc.invalidateQueries({ queryKey: ["gallery", params.chatId] });
              break;
            }

            case "illustration_queued": {
              illustrationQueued = true;
              break;
            }

            case "agent_error": {
              const errData = event.data as {
                agentType: string;
                agentName?: string | null;
                error: string;
                retryTarget?: unknown;
              };
              if (errData.agentType === "illustrator" && errData.retryTarget !== "background") {
                illustrationSettled = true;
              }
              const failure = toAgentFailure(errData);
              const failureState = useAgentStore.getState();
              const existingFailures =
                failureState.failedAgentChatId && failureState.failedAgentChatId !== params.chatId
                  ? []
                  : failureState.failedAgentFailures;
              setFailedAgentFailures(mergeAgentFailures(existingFailures, [failure]), params.chatId);
              showAgentFailuresError([failure], () => {
                void retryAgentsRef.current?.(
                  params.chatId,
                  [failure.agentType],
                  withIllustratorFailureTargets(undefined, [failure]),
                );
              });
              break;
            }

            case "scene_created": {
              const sceneData = event.data as {
                sceneChatId: string;
                sceneChatName: string;
                description: string;
                background?: string | null;
                initiatorCharId: string;
                initiatorCharName: string;
              };
              toast(`${sceneData.initiatorCharName} started a scene: ${sceneData.sceneChatName}`, { icon: "🎬" });
              // Invalidate chat list so the new scene chat appears
              qc.invalidateQueries({ queryKey: ["chats"] });
              // Apply background if the scene chose one
              if (sceneData.background) {
                useUIStore
                  .getState()
                  .setChatBackground(`/api/backgrounds/file/${encodeURIComponent(sceneData.background)}`);
              }
              break;
            }

            case "scene_requested": {
              const sceneData = event.data as {
                originChatId?: string;
                prompt?: string;
                background?: string | null;
                plan?: string | null;
                initiatorCharId?: string | null;
                initiatorCharName?: string | null;
              };
              const sceneOriginChatId = sceneData.originChatId || params.chatId;
              if (!isChatSurfaceVisible(sceneOriginChatId)) {
                break;
              }
              void startSceneWithPromptPreferences({
                chatId: sceneOriginChatId,
                prompt: sceneData.prompt ?? "",
                background: sceneData.background ?? null,
                planHint: sceneData.plan ?? null,
                initiatorCharId: sceneData.initiatorCharId ?? null,
                initiatorCharName: sceneData.initiatorCharName ?? "Character",
                connectionId: params.connectionId,
                onCreated: () => {
                  qc.invalidateQueries({ queryKey: chatKeys.all });
                },
              }).catch((error) => {
                console.warn("[scene] Failed to handle requested scene:", error);
              });
              break;
            }

            case "haptic_command": {
              break;
            }

            case "assistant_commands_start": {
              const commandData = event.data as { professorMariCommandCount?: number } | undefined;
              if ((commandData?.professorMariCommandCount ?? 0) <= 0) break;
              setMariPhase(params.chatId, "updating");
              window.dispatchEvent(
                new CustomEvent("marinara:mari-phase", {
                  detail: { chatId: params.chatId, phase: "updating" },
                }),
              );
              break;
            }

            case "assistant_commands_end": {
              clearMariPhaseForThisChat();
              break;
            }

            case "assistant_action": {
              const actionData = event.data as { action: string; [key: string]: unknown };
              if (actionData.action === "persona_created") {
                toast(`Created persona: ${actionData.name}`, { icon: "🎭" });
                qc.invalidateQueries({ queryKey: ["personas"] });
              } else if (actionData.action === "persona_updated") {
                toast(`Updated persona: ${actionData.name}`, { icon: "🎭" });
                qc.invalidateQueries({ queryKey: ["personas"] });
              } else if (actionData.action === "character_created") {
                toast(`Created character: ${actionData.name}`, { icon: "✨" });
                qc.invalidateQueries({ queryKey: characterKeys.list() });
              } else if (actionData.action === "character_updated") {
                toast(`Updated character: ${actionData.name}`, { icon: "✏️" });
                qc.invalidateQueries({ queryKey: characterKeys.list() });
                if (typeof actionData.id === "string" && actionData.id.length > 0) {
                  qc.invalidateQueries({ queryKey: characterKeys.detail(actionData.id) });
                  qc.invalidateQueries({ queryKey: characterKeys.versions(actionData.id) });
                }
              } else if (actionData.action === "lorebook_created") {
                const entryCount = Number(actionData.entryCount ?? 0);
                toast(`Created lorebook: ${actionData.name}${entryCount > 0 ? ` (${entryCount} entries)` : ""}`, {
                  icon: "📚",
                });
                qc.invalidateQueries({ queryKey: lorebookKeys.all });
              } else if (actionData.action === "preset_created") {
                const sectionCount = Number(actionData.sectionCount ?? 0);
                toast(`Created preset: ${actionData.name}${sectionCount > 0 ? ` (${sectionCount} sections)` : ""}`, {
                  icon: "🧩",
                });
                qc.invalidateQueries({ queryKey: presetKeys.all });
              } else if (actionData.action === "chat_created") {
                toast(`Started ${actionData.mode} chat with ${actionData.characterName}`, { icon: "💬" });
                qc.invalidateQueries({ queryKey: ["chats"] });
                if (typeof actionData.chatId === "string") {
                  if (actionData.chatId === params.chatId) {
                    invalidateCurrentMessagesIfSafe();
                  } else {
                    qc.invalidateQueries({ queryKey: chatKeys.messages(actionData.chatId) });
                  }
                }
              } else if (actionData.action === "dm_posted") {
                if (typeof actionData.chatId === "string") {
                  qc.invalidateQueries({ queryKey: ["chats"] });
                  if (actionData.chatId === params.chatId) {
                    invalidateCurrentMessagesIfSafe();
                  } else {
                    qc.invalidateQueries({ queryKey: chatKeys.messages(actionData.chatId) });
                  }
                  qc.invalidateQueries({ queryKey: lorebookKeys.active(actionData.chatId) });
                }
              } else if (actionData.action === "data_fetched") {
                const fetchType = (actionData.fetchType as string) ?? "data";
                toast(`Fetched ${fetchType}: ${actionData.name}`, { icon: "📋" });
              } else if (actionData.action === "suggestions") {
                const suggestions = Array.isArray(actionData.suggestions)
                  ? (actionData.suggestions as MariSuggestionChip[])
                  : [];
                if (useUIStore.getState().professorMariSuggestionsEnabled) setMariChips(params.chatId, suggestions);
              } else if (actionData.action === "plan") {
                const plan = Array.isArray(actionData.plan) ? (actionData.plan as MariGuidedPlanStep[]) : [];
                if (useUIStore.getState().professorMariSuggestionsEnabled && plan.length > 0)
                  setMariPlan(params.chatId, plan);
              } else if (actionData.action === "navigate") {
                const panel = actionData.panel as string;
                const tab = actionData.tab as string | null;
                useUIStore.getState().openRightPanel(panel as any);
                if (panel === "settings" && tab) {
                  useUIStore.getState().setSettingsTab(tab as any);
                }
              }
              break;
            }

            case "done": {
              sawDoneEvent = true;
              if (illustrationQueued && !illustrationSettled) {
                useChatStore.getState().setBackgroundIllustration(params.chatId, true);
              }
              if (spriteChangeReceived) {
                qc.invalidateQueries({ queryKey: chatKeys.messages(params.chatId) });
              }
              // Final UI handoff happens after the typewriter drains below.
              // Clearing here makes the completed persisted message flash in
              // while tokens or a held rewrite are still being animated.
              clearMariPhaseForThisChat();
              break;
            }

            case "typing": {
              // Generation is about to start — show "X is typing..."
              const typingNames = (event as any).characters as string[] | undefined;
              leadingSpeakerPrefixFilter.addLabels(typingNames ?? []);
              const typingLabel = typingNames?.length === 1 ? typingNames[0] : (typingNames?.join(", ") ?? "Character");
              useChatStore.getState().setPerChatTyping(params.chatId, typingLabel);
              if (isActiveChat()) setTypingCharacterName(typingLabel);
              break;
            }

            case "delayed": {
              // Character is busy (DND/idle) — show waiting indicator
              const delayedNames = (event as any).characters as string[] | undefined;
              const delayedLabel =
                delayedNames?.length === 1 ? delayedNames[0] : (delayedNames?.join(", ") ?? "Character");
              const delayedStatus = ((event as any).status as DelayedCharacterInfo["status"] | undefined) ?? "idle";
              const delayedInfo: DelayedCharacterInfo = {
                name: delayedLabel,
                status: delayedStatus,
                characterIds: Array.isArray((event as any).characterIds)
                  ? ((event as any).characterIds as string[])
                  : undefined,
                characterNames: delayedNames,
                characterStatuses:
                  (event as any).characterStatuses && typeof (event as any).characterStatuses === "object"
                    ? ((event as any).characterStatuses as DelayedCharacterInfo["characterStatuses"])
                    : undefined,
              };
              useChatStore.getState().setPerChatDelayed(params.chatId, delayedInfo);
              if (isActiveChat()) setDelayedCharacterInfo(delayedInfo);
              // Refresh character data so sidebar status dots update immediately
              qc.invalidateQueries({ queryKey: characterKeys.list() });
              break;
            }

            case "offline": {
              // Character is offline — message was saved but no generation
              const names = (event as any).characters as string[] | undefined;
              const label = names?.length === 1 ? names[0] : "Characters";
              toast(`${label} is offline. They'll respond when they're back online.`, { icon: "💤" });
              setProcessing(false, params.chatId);
              break;
            }

            case "ooc_posted": {
              // OOC messages were posted to the connected conversation — invalidate its messages
              const oocData = event.data as { chatId: string; count: number };
              if (oocData.chatId) {
                if (oocData.chatId === params.chatId) {
                  invalidateCurrentMessagesIfSafe();
                } else {
                  qc.invalidateQueries({ queryKey: chatKeys.messages(oocData.chatId) });
                }
                qc.invalidateQueries({ queryKey: lorebookKeys.active(oocData.chatId) });
              }
              break;
            }

            case "error": {
              // Flush pending text so the user sees what arrived before the error
              flushLeadingSpeakerPrefix();
              flushTypewriterBuffer();
              setProcessing(false, params.chatId);
              clearMariPhaseForThisChat();
              showError((event.data as string) || "Generation failed");
              window.dispatchEvent(new CustomEvent("marinara:generation-error", { detail: { chatId: params.chatId } }));
              break;
            }

            case "agents_retry_failed": {
              const failedList = event.data as Array<{
                agentType: string;
                agentName?: string | null;
                error: string | null;
              }>;
              const failures = failedList.map(toAgentFailure);
              setFailedAgentFailures(failures, params.chatId);
              showAgentFailuresError(failures, () => {
                void retryAgentsRef.current?.(
                  params.chatId,
                  failures.map((failure) => failure.agentType),
                );
              });
              break;
            }
          }
        }

        // Wait for typewriter to finish draining pending text (streaming mode only)
        flushThinkingStreamFilter();
        flushLeadingSpeakerPrefix();
        if (streamingEnabled && shouldDisplayRawStream && isActiveChat() && (pendingText.length > 0 || typingActive)) {
          await waitForTypewriterDrain();
        }
        // Final flush — ensure full content is set (only for the viewed chat)
        if (streamingEnabled && shouldDisplayRawStream) {
          setStreamBuffer(normalizeLineBreakSpacing(fullBuffer + pendingText), params.chatId);
        }
      } catch (error) {
        // Flush everything instantly on error so user sees what arrived
        flushLeadingSpeakerPrefix();
        flushTypewriterBuffer();
        // Abort is intentional — don't log or toast
        if (isAbortError(error)) return receivedContent || spatialTransitionCommitted;
        if (isPassiveStreamDisconnect(error, pageWasHiddenDuringStream, abortController.signal)) {
          passiveStreamRecovered = true;
          if (isActiveChat()) useChatStore.getState().setGenerationPhase("Finishing in background...");
          const settled = await waitForServerGenerationToSettle(params.chatId, abortController.signal);
          passiveStreamSettled = settled;
          if (!abortController.signal.aborted) {
            const recoveryRefetchSucceeded = await refreshMessagesAuthoritatively(
              qc,
              params.chatId,
              persistedMessages.values(),
            );
            if (recoveryRefetchSucceeded) {
              passiveRecoveryDurableMessage = latestNewMessageByRole(
                qc,
                params.chatId,
                expectedPersistedRole,
                expectedMessagesBeforeGeneration,
              );
              if (passiveRecoveryDurableMessage) {
                persistedMessages.set(passiveRecoveryDurableMessage.id, passiveRecoveryDurableMessage);
              }
            }
            if (!settled) {
              toast.info(
                "Generation is still finishing in the background. Refresh the chat in a moment if it has not appeared.",
              );
            }
          }
          return abortController.signal.aborted ? receivedContent || spatialTransitionCommitted : true;
        }
        if (params.pendingSpatialTransition) {
          const payload = error instanceof ApiError && error.payload && typeof error.payload === "object"
            ? (error.payload as Record<string, unknown>)
            : null;
          const spatialErrorCode = typeof payload?.code === "string" ? payload.code : null;
          if (spatialErrorCode === "spatial_transition_already_applied") {
            spatialTransitionCommitted = true;
          } else if (!spatialErrorCode?.startsWith("spatial_")) {
            try {
              const current = await api.get<SpatialContextResponse>(`/chats/${params.chatId}/spatial-context`);
              qc.setQueryData(spatialContextKeys.detail(params.chatId), current);
              spatialTransitionCommitted =
                current.currentLocationId === params.pendingSpatialTransition.destinationId;
            } catch {
              /* Preserve the pending command when current state cannot be confirmed. */
            }
          }
          if (spatialTransitionCommitted) {
            useChatStore
              .getState()
              .clearPendingSpatialTransition(params.chatId, params.pendingSpatialTransition.commandId);
            void qc.invalidateQueries({ queryKey: chatKeys.detail(params.chatId) });
            return true;
          }
          useChatStore.getState().setPendingSpatialTransitionStatus(params.chatId, "needs_review");
        }
        const msg = error instanceof Error ? error.message : "Generation failed";
        showError(msg);
        window.dispatchEvent(new CustomEvent("marinara:generation-error", { detail: { chatId: params.chatId } }));
        return false;
      } finally {
        // Stream has terminated (done, error, abort, or unexpected throw) —
        // guarantee the Mari indicator clears even if the end SSE never arrived.
        clearMariPhaseForThisChat();
        // A provider can close the SSE immediately after its final agent event.
        // If this generation still owns the visible Roleplay stream, drain the
        // queued typewriter before cleanup exposes the already-saved full row.
        // Error and abort paths flush/cancel explicitly and therefore skip this.
        const ownsVisibleTypewriter =
          !abortController.signal.aborted &&
          isActiveChat() &&
          useChatStore.getState().streamingChatId === params.chatId;
        if (ownsVisibleTypewriter && (pendingText.length > 0 || typingActive)) {
          await waitForTypewriterDrain();
        }
        // Cancel any pending animation frame to prevent leaks
        cancelAnimationFrame(rafId);
        if (canInspectPageFocus) {
          document.removeEventListener("visibilitychange", recordBackgroundedStream);
          window.removeEventListener("pagehide", markPageHidden);
        }
        const stillOwnerAtCleanupStart =
          useChatStore.getState().abortControllers.get(params.chatId) === abortController;
        if (stillOwnerAtCleanupStart) {
          useChatStore.getState().clearPerChatState(params.chatId);
          useChatStore.getState().setAbortController(params.chatId, null);
          useChatStore.getState().setBackgroundIllustration(params.chatId, false);
        }

        if (shouldRefreshGameState) {
          // Refresh game state from DB so HUD/sidebar trackers settle on the
          // persisted active-swipe row after generation-time SSE patches.
          await refreshVisibleGameStateAfterGeneration(params.chatId);
        }
        if (isGameGeneration && sawDoneEvent && receivedContent) {
          const uiState = useUIStore.getState();
          playConfiguredNotificationPing(uiState.gameNotificationSound, uiState.notificationSoundsOnlyWhenUnfocused);
          gameTurnLoadedSoundPlayed = true;
        }
        // Re-sort sidebar so this chat floats to the top
        qc.invalidateQueries({ queryKey: chatKeys.list() });
        // If the user navigated away from this chat during generation,
        // increment unread badge + play notification sound so they know.
        // Only notify if actual content was produced (skip offline/error cases).
        const currentActive = useChatStore.getState().activeChatId;
        const hasDurableAssistantReply = latestAssistantMessage(persistedMessages.values()) !== null;
        const notificationEligibleContent =
          receivedContent &&
          (!passiveStreamRecovered || hasDurableAssistantReply) &&
          (!sawGroupTurn || currentGroupTurnSavedMessage !== null);
        if (notificationEligibleContent && currentActive !== params.chatId) {
          useChatStore.getState().incrementUnread(params.chatId);
          // Show floating avatar notification bubble — look up character from cache
          const chatList = qc.getQueryData<Chat[]>(chatKeys.list());
          const chat = chatList?.find((c) => c.id === params.chatId);
          const rawIds = chat?.characterIds;
          const parsedIds: string[] =
            typeof rawIds === "string"
              ? (() => {
                  try {
                    return JSON.parse(rawIds);
                  } catch {
                    return [];
                  }
                })()
              : Array.isArray(rawIds)
                ? rawIds
                : [];
          const notifiedMessage = latestAssistantMessage(persistedMessages.values());
          const notifiedCharacterId = resolveNotifiedCharacterId(
            notifiedMessage,
            params.forCharacterId,
            parsedIds[0] ?? null,
          );
          if (notifiedCharacterId) {
            const identity = resolveCachedCharacterIdentity(qc, notifiedCharacterId);
            useChatStore
              .getState()
              .addNotification(params.chatId, identity.name ?? "Character", identity.avatarUrl, identity.avatarCrop);
          }
          const isRp = chat?.mode === "roleplay" || chat?.mode === "visual_novel";
          const isGame = chat?.mode === "game" || isGameGeneration;
          const uiState = useUIStore.getState();
          const soundEnabled = isGame
            ? sawDoneEvent && uiState.gameNotificationSound && !gameTurnLoadedSoundPlayed
            : isRp
              ? uiState.rpNotificationSound
              : uiState.convoNotificationSound;
          playConfiguredNotificationPing(soundEnabled, uiState.notificationSoundsOnlyWhenUnfocused);
        }
        // Only clean up global streaming state if this generation still
        // "owns" it. We check AbortController identity rather than chatId
        // because two generations can target the same chat (e.g. autonomous
        // + user send). The latest generation replaces the AbortController,
        // so the superseded one knows it no longer owns the state.
        const stillOwner = stillOwnerAtCleanupStart;
        const partialContent = normalizeLineBreakSpacing(fullBuffer + pendingText).trim();
        let unpersistedPartialMessage: Message | null = null;
        if (
          receivedContent &&
          persistedMessages.size === 0 &&
          partialContent &&
          !params.regenerateMessageId &&
          !params.continueMessageId
        ) {
          const createdAt = new Date().toISOString();
          const partialRole = params.impersonate ? "user" : "assistant";
          const partialCharacterId = params.impersonate
            ? null
            : (params.forCharacterId ?? useChatStore.getState().streamingCharacterId ?? null);
          if (passiveStreamRecovered) {
            if (!passiveRecoveryDurableMessage) {
              unpersistedPartialMessage = createCacheOnlyPartialMessage({
                chatId: params.chatId,
                role: partialRole,
                characterId: partialCharacterId,
                content: partialContent,
                createdAt,
              });
            }
          } else {
            try {
              const created = await api.post<Message>(`/chats/${params.chatId}/messages`, {
                role: partialRole,
                characterId: partialCharacterId,
                content: partialContent,
                createdAt,
                updatedAt: createdAt,
              });
              unpersistedPartialMessage = created;
              persistedMessages.set(created.id, created);
            } catch (error) {
              console.warn(
                "[use-generate] Failed to persist stopped partial message; keeping cache-only fallback",
                error,
              );
              unpersistedPartialMessage = createCacheOnlyPartialMessage({
                chatId: params.chatId,
                role: partialRole,
                characterId: partialCharacterId,
                content: partialContent,
                createdAt,
              });
            }
          }
        }
        const persistedForRefresh = [
          ...persistedMessages.values(),
          ...(unpersistedPartialMessage && !persistedMessages.has(unpersistedPartialMessage.id)
            ? [unpersistedPartialMessage]
            : []),
        ];
        const primeMessagesFromSaved = () => {
          if (persistedForRefresh.length > 0) {
            upsertPersistedMessages(qc, params.chatId, persistedForRefresh);
          }
        };
        const refreshMessagesInBackground = () => {
          void refreshMessagesAuthoritatively(qc, params.chatId, persistedForRefresh);
        };
        if (stillOwner) {
          // Only clear global streaming/UI state if this chat is still the one
          // being displayed, to avoid corrupting another chat's active generation.
          if (useChatStore.getState().streamingChatId === params.chatId) {
            if (isGameGeneration) {
              // Game mode still needs the authoritative refresh before release
              // because the scene/HUD pipeline depends on the final snapshot.
              await refreshMessagesAuthoritatively(qc, params.chatId, persistedForRefresh);
              setStreaming(false);
              clearStreamBuffer(params.chatId);
            } else {
              if (receivedContent && persistedForRefresh.length === 0) {
                await refreshMessagesAuthoritatively(qc, params.chatId, persistedForRefresh);
              } else {
                primeMessagesFromSaved();
              }
              // Prime the durable message before releasing the live stream so
              // React never renders an empty frame or the wrong full response.
              setStreaming(false);
              clearStreamBuffer(params.chatId);
              if (persistedForRefresh.length > 0) refreshMessagesInBackground();
            }
          } else {
            if (isGameGeneration || (receivedContent && persistedForRefresh.length === 0)) {
              await refreshMessagesAuthoritatively(qc, params.chatId, persistedForRefresh);
            } else {
              primeMessagesFromSaved();
              refreshMessagesInBackground();
            }
            clearStreamBuffer(params.chatId);
          }
          setProcessing(false, params.chatId);
          setStreamedMessageId(params.chatId, null);
          if (isActiveChat()) {
            setRegenerateMessageId(null);
            setStreamingCharacterId(null);
            setTypingCharacterName(null);
            setDelayedCharacterInfo(null);
          }
        } else {
          // Not the owner but still need messages up to date
          if (isGameGeneration || (receivedContent && persistedForRefresh.length === 0)) {
            await refreshMessagesAuthoritatively(qc, params.chatId, persistedForRefresh);
          } else {
            primeMessagesFromSaved();
            refreshMessagesInBackground();
          }
        }

        const completedReply =
          !abortController.signal.aborted &&
          !params.impersonate &&
          !params.turnGameBots &&
          ((sawDoneEvent && receivedContent) ||
            (passiveStreamSettled && passiveRecoveryDurableMessage?.role === "assistant"));
        if (completedReply) {
          const notifiedMessage =
            latestAssistantMessage(persistedForRefresh) ??
            latestChangedAssistantMessage(qc, params.chatId, assistantMessagesBeforeGeneration);
          if (notifiedMessage) {
            const chat = getCachedChatForGeneration(qc, params.chatId);
            const fallbackCharacterId = parseChatCharacterIds(chat?.characterIds)[0] ?? null;
            const notifiedCharacterId = resolveNotifiedCharacterId(
              notifiedMessage,
              params.forCharacterId,
              fallbackCharacterId,
            );
            const characterName = notifiedCharacterId ? getCachedCharacterName(qc, notifiedCharacterId) : null;
            const uiState = useUIStore.getState();
            const notification = {
              characterName,
              title: replyNotificationTitle(chat?.mode ?? chatModeForGeneration, characterName),
              tag: `marinara-chat-${params.chatId}`,
            };
            void showLocalMessageNotification({
              ...notification,
              enabled: params.autonomous
                ? uiState.conversationBrowserNotifications
                : uiState.generationBrowserNotifications,
            });
            showNativeMessageNotification({
              ...notification,
              enabled: params.autonomous
                ? uiState.conversationMobileNotifications
                : uiState.generationMobileNotifications,
            });
          }
        }

        // Always notify game surface that generation completed for this chat.
        // Dispatched unconditionally — GameSurface uses lastProcessedMsgRef
        // to prevent duplicate processing.
        if (useUIStore.getState().debugMode) {
          console.warn("[use-generate] dispatching generation-complete for chat:", params.chatId);
        }
        window.dispatchEvent(new CustomEvent("marinara:generation-complete", { detail: { chatId: params.chatId } }));

        // Auto-translate newly generated assistant messages if enabled
        if (receivedContent) {
          try {
            const chatData = qc.getQueryData<Chat>(chatKeys.detail(params.chatId));
            const meta = parseChatMetadata(chatData?.metadata);
            if (meta.autoTranslate) {
              const store = useTranslationStore.getState();
              const chatSystemPrompt =
                typeof meta.translationPrompt === "string" && meta.translationPrompt.trim().length > 0
                  ? meta.translationPrompt
                  : store.config.systemPrompt;
              for (const [id, msg] of persistedMessages) {
                const textToTranslate =
                  chatData?.mode === "game" ? stripGmTagsKeepReadables(msg.content ?? "").trim() : (msg.content ?? "");
                if (
                  msg.role === "assistant" &&
                  textToTranslate &&
                  !store.translations[id] &&
                  !store.hiddenTranslationIds[id]
                ) {
                  store.setTranslating(id, true);
                  api
                    .post<{ translatedText: string }>("/translate", {
                      text: textToTranslate,
                      provider: store.config.provider,
                      targetLanguage: store.config.targetLanguage,
                      connectionId: store.config.connectionId,
                      systemPrompt: chatSystemPrompt,
                      deeplApiKey: store.config.deeplApiKey,
                      deeplxUrl: store.config.deeplxUrl,
                    })
                    .then((result) => {
                      store.setTranslation(id, result.translatedText);
                      store.setTranslating(id, false);
                      // Persist to message extra
                      api
                        .patch(`/chats/${params.chatId}/messages/${id}/extra`, {
                          translation: result.translatedText,
                          translationHidden: false,
                        })
                        .catch(() => {});
                    })
                    .catch(() => {
                      store.setTranslating(id, false);
                    });
                }
              }
            }
          } catch {
            /* non-critical — don't block generation cleanup */
          }
        }
      }
      return receivedContent || passiveStreamRecovered || spatialTransitionCommitted;
    },
    [
      qc,
      setStreaming,
      setMariPhase,
      setStreamBuffer,
      setStreamCommitted,
      setStreamedMessageId,
      clearStreamBuffer,
      appendThinkingBuffer,
      clearThinkingBuffer,
      setRegenerateMessageId,
      setStreamingCharacterId,
      setResponseQueue,
      completeQueuedResponse,
      clearResponseQueue,
      setTypingCharacterName,
      setDelayedCharacterInfo,
      setProcessing,
      addResult,
      addDebugEntry,
      addThoughtBubble,
      clearThoughtBubbles,
      enqueueEchoMessages,
      setCyoaChoices,
      clearCyoaChoices,
      setMariChips,
      clearMariChips,
      setMariPlan,
      clearMariPlan,
      setYoutubePlay,
      setYoutubeVolume,
      setLocalMusicPlay,
      setLocalMusicVolume,
      enqueuePendingCardUpdate,
      enqueuePendingAgentWriteApproval,
      clearFailedAgentTypes,
      setFailedAgentFailures,
    ],
  );

  const retryAgents = useCallback(
    async (chatId: string, agentTypes: string[], options?: RetryAgentsOptions): Promise<boolean> => {
      const isActiveChat = () => useChatStore.getState().activeChatId === chatId;
      const abortController = new AbortController();
      if (useChatStore.getState().abortControllers.has(chatId)) {
        console.warn("[RetryAgents] Skipped — generation already in progress for this chat");
        return false;
      }
      useChatStore.getState().setAbortController(chatId, abortController);
      useChatStore.getState().setBackgroundIllustration(chatId, false);
      const isIllustratorOnlyRetry = agentTypes.length === 1 && agentTypes[0] === "illustrator";
      const isTrackerRetry = agentTypes.some(
        (agentType) => isBuiltInTrackerAgentType(agentType) || !isBuiltInAgentType(agentType),
      );
      setProcessing(true, chatId);
      if (isTrackerRetry) useGameStateStore.getState().setRefreshingChat(chatId);
      clearFailedAgentTypes(chatId);
      if (isActiveChat()) clearThoughtBubbles();
      let hasError = false;
      let imagePromptReviewRequested = false;

      try {
        const flushPatch = useGameStateStore.getState().flushPatch;
        if (flushPatch) {
          try {
            await flushPatch();
          } catch (error) {
            const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
            throw new Error(`Failed to flush pending game-state edits${detail}`, { cause: error });
          }
        }

        await waitForPendingChatMetadataSaves(chatId);
        const currentBackground = getActiveChatBackgroundForGeneration(chatId);

        let agentResultCount = 0;
        let trackerPatchCount = 0;
        let spriteChangeReceived = false;
        const failedRetryFailures: Array<ReturnType<typeof toAgentFailure>> = [];
        const retryDebugMode = useUIStore.getState().debugMode;
        for await (const event of api.streamEvents(
          "/generate/retry-agents",
          {
            chatId,
            agentTypes,
            ...(currentBackground !== undefined ? { currentBackground } : {}),
            streaming: useUIStore.getState().enableStreaming,
            debugMode: retryDebugMode,
            queueImageGenerationRequests: useUIStore.getState().queueImageGenerationRequests,
            reviewImagePromptsBeforeSend: useUIStore.getState().reviewImagePromptsBeforeSend,
            ...(options?.agentPromptTemplateIds ? { agentPromptTemplateIds: options.agentPromptTemplateIds } : {}),
            ...(options?.illustratorPromptReviewOverride
              ? { illustratorPromptReviewOverride: options.illustratorPromptReviewOverride }
              : {}),
            ...(options?.illustratorRetryTargets ? { illustratorRetryTargets: options.illustratorRetryTargets } : {}),
            musicPlayerEnabled: useUIStore.getState().musicPlayerEnabled,
            musicPlayerSource: useUIStore.getState().musicPlayerSource,
            lorebookKeeperBackfill: options?.lorebookKeeperBackfill === true,
            ...(options?.forMessageId ? { forMessageId: options.forMessageId } : {}),
            ...(options?.secretPlotRerollMode ? { secretPlotRerollMode: options.secretPlotRerollMode } : {}),
          },
          abortController.signal,
        )) {
          switch (event.type) {
            case "agent_warning": {
              showAgentWarning(event.data, chatId);
              break;
            }

            case "agent_result": {
              const result = event.data as {
                agentType: string;
                agentName: string;
                resultType: string;
                data: unknown;
                tokensUsed?: number;
                success: boolean;
                error: string | null;
                durationMs: number;
              };
              agentResultCount += 1;

              if (retryDebugMode) {
                if (result.success) {
                  console.warn(
                    `[Retry Agent] ✓ ${result.agentName} (${result.agentType}) — ${(result.durationMs / 1000).toFixed(1)}s`,
                    result.data,
                  );
                } else {
                  console.warn(
                    `[Retry Agent] ✗ ${result.agentName} (${result.agentType}) — ${result.error ?? "unknown error"}`,
                    result.data,
                  );
                }
              }

              if (result.success) {
                qc.invalidateQueries({ queryKey: agentKeys.customRuns(chatId) });
                if (result.resultType === "sprite_change") {
                  spriteChangeReceived = true;
                  qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
                }
                if (result.resultType === "spotify_control") {
                  qc.invalidateQueries({ queryKey: ["spotify", "player"] });
                }
              }

              addResult(result.agentType, {
                agentId: result.agentType,
                agentType: result.agentType,
                type: result.resultType as any,
                data: result.data,
                tokensUsed: result.tokensUsed ?? 0,
                durationMs: result.durationMs,
                success: result.success,
                error: result.error,
              });
              const writeApproval = result.success
                ? readAgentWriteApprovalProposal(result.data, {
                    chatId,
                    agentType: result.agentType,
                    agentName: result.agentName,
                  })
                : null;
              if (writeApproval) {
                enqueuePendingAgentWriteApproval(createPendingAgentWriteApproval(writeApproval));
                if (isActiveChat()) useUIStore.getState().openModal("agent-write-approval");
              }
              if (result.success && result.resultType === "character_card_update") {
                buildPendingCardUpdates(qc, chatId, result.agentType, result.agentName, result.data)
                  .then((pendingEntries) => {
                    if (pendingEntries.length > 0) {
                      for (const pending of pendingEntries) {
                        enqueuePendingCardUpdate(pending);
                      }
                      useUIStore.getState().openModal("character-card-update");
                    }
                  })
                  .catch((err) => console.warn("[Agent] Failed to build card update entry:", err));
              }
              const bubble = result.success
                ? (formatAgentBubble(result.agentType, result.agentName, result.data) ??
                  formatRetryAgentActivityBubble(result, isTrackerRetry))
                : null;
              if (isActiveChat() && bubble) addThoughtBubble(result.agentType, result.agentName, bubble);

              if (result.success && result.data) {
                if (result.agentType === "echo-chamber") {
                  const d = result.data as Record<string, unknown>;
                  const reactions = (d.reactions as Array<{ characterName: string; reaction: string }>) ?? [];
                  if (isActiveChat()) enqueueEchoMessages(reactions);
                }
                // CYOA re-roll: push the freshly generated choices into the store
                // so the buttons in CyoaChoices.tsx swap in immediately.
                if (result.agentType === "cyoa") {
                  const d = result.data as Record<string, unknown>;
                  const choices = (d.choices as Array<{ label: string; text: string }>) ?? [];
                  if (isActiveChat()) setCyoaChoices(choices, chatId);
                }
                // YouTube re-pick: drive the in-app player with the fresh intent.
                if (result.resultType === "youtube_control" && isActiveChat()) {
                  const d = result.data as Record<string, unknown>;
                  const action = d.action as string;
                  if (typeof d.volume === "number" && Number.isFinite(d.volume)) {
                    setYoutubeVolume(Math.max(0, Math.min(100, d.volume)));
                  }
                  if (action === "play" && typeof d.searchQuery === "string" && d.searchQuery.trim()) {
                    setYoutubePlay({ searchQuery: d.searchQuery.trim(), mood: (d.mood as string) ?? "" });
                  }
                }
                if (result.resultType === "local_music_control" && isActiveChat()) {
                  const d = result.data as Record<string, unknown>;
                  const action = d.action as string;
                  if (typeof d.volume === "number" && Number.isFinite(d.volume)) {
                    setLocalMusicVolume(Math.max(0, Math.min(100, d.volume)));
                  }
                  const path = typeof d.path === "string" ? d.path.trim() : "";
                  if (action === "play" && path) {
                    const trackName = typeof d.trackName === "string" ? d.trackName.trim() : "";
                    const fallbackTitle =
                      path
                        .split("/")
                        .pop()
                        ?.replace(/\.[^.]+$/, "")
                        .replace(/[-_]+/g, " ") || "Local track";
                    setLocalMusicPlay({
                      path,
                      title: trackName || fallbackTitle,
                      mood: (d.mood as string) ?? "",
                    });
                  }
                }
                if (result.resultType === "background_change") {
                  const bg = result.data as { chosen?: string | null; generated?: boolean };
                  if (bg.chosen) {
                    applyAgentBackgroundChoice(bg.chosen);
                  }
                  if (bg.generated) {
                    qc.invalidateQueries({ queryKey: ["backgrounds"] });
                  }
                }
                // Apply quest updates directly so the widget updates immediately
                if (result.agentType === "quest") {
                  const qd = result.data as Record<string, unknown>;
                  const updates = Array.isArray(qd.updates) ? qd.updates : [];
                  if (updates.length > 0) {
                    const cur = useGameStateStore.getState().current;
                    const existing = cur?.playerStats ?? {
                      stats: [],
                      attributes: null,
                      skills: {},
                      inventory: [],
                      activeQuests: [],
                      status: "",
                    };
                    const questMerge = applyQuestUpdatesToPlayerStats(existing, updates);
                    applyGameStatePatchToStore(chatId, { playerStats: questMerge.playerStats });
                  }
                }
              }
              if (!result.success && result.error) {
                hasError = true;
                const failure = toAgentFailure(result);
                failedRetryFailures.push(failure);
                setFailedAgentFailures(failedRetryFailures, chatId);
                showAgentFailuresError([failure], () => {
                  void retryAgentsRef.current?.(
                    chatId,
                    [failure.agentType],
                    withIllustratorFailureTargets(options, [failure]),
                  );
                });
              }
              break;
            }
            case "agent_debug": {
              if (!useUIStore.getState().debugMode) break;
              addDebugEntry({
                phase: "agent_call",
                agentCall: event.data as AgentCallDebugEvent,
              });
              break;
            }
            case "agents_retry_failed": {
              hasError = true;
              const failedList = event.data as Array<{
                agentType: string;
                agentName?: string | null;
                error: string | null;
              }>;
              const failures = failedList.map(toAgentFailure);
              setFailedAgentFailures(failures, chatId);
              showAgentFailuresError(failures, () => {
                void retryAgentsRef.current?.(
                  chatId,
                  failures.map((failure) => failure.agentType),
                  withIllustratorFailureTargets(options, failures),
                );
              });
              break;
            }
            case "game_state":
            case "game_state_patch": {
              const patch = event.data as Record<string, unknown>;
              if (retryDebugMode) console.warn(`[Retry] ${event.type} received:`, patch);
              if (patch && Object.keys(patch).length > 0) trackerPatchCount += 1;
              if (!isActiveChat()) break;
              discardPendingGameStatePatch(chatId);
              applyGameStatePatchToStore(chatId, patch);
              break;
            }
            case "turn_game_state_patch": {
              const turnGameType = (event.data as { gameType?: string } | null)?.gameType;
              if (turnGameType) {
                dispatchCapabilityClientEvent({ packageId: turnGameType, type: event.type, chatId, data: event.data });
              }
              break;
            }
            case "game_map_update": {
              const map = event.data as GameMap | null;
              if (map) applyGameMapUpdate(qc, chatId, map);
              break;
            }
            case "agent_write_proposal": {
              const proposal = readAgentWriteApprovalProposal(event.data, { chatId });
              if (proposal) {
                enqueuePendingAgentWriteApproval(createPendingAgentWriteApproval(proposal));
                if (isActiveChat()) useUIStore.getState().openModal("agent-write-approval");
              }
              break;
            }
            case "illustration": {
              const illData = event.data as { messageId: string; imageUrl: string; reason?: string };
              toast(illData.reason ? `🎨 ${illData.reason}` : "🎨 Scene illustration generated");
              // Refresh messages so the illustration attachment appears
              if (isActiveChat()) {
                qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
                qc.invalidateQueries({ queryKey: ["gallery", chatId] });
              }
              break;
            }
            case "illustration_queued": {
              if (isIllustratorOnlyRetry) {
                useChatStore.getState().setBackgroundIllustration(chatId, true);
              }
              break;
            }
            case "image_prompt_review": {
              imagePromptReviewRequested = true;
              window.dispatchEvent(
                new CustomEvent("marinara:image-prompt-review", {
                  detail: event.data,
                }),
              );
              break;
            }
            case "agent_error": {
              const errData = event.data as {
                agentType: string;
                agentName?: string | null;
                error: string;
                retryTarget?: unknown;
              };
              hasError = true;
              const failure = toAgentFailure(errData);
              const mergedFailures = mergeAgentFailures(failedRetryFailures, [failure]);
              failedRetryFailures.splice(0, failedRetryFailures.length, ...mergedFailures);
              setFailedAgentFailures(failedRetryFailures, chatId);
              showAgentFailuresError([failure], () => {
                void retryAgentsRef.current?.(
                  chatId,
                  [failure.agentType],
                  withIllustratorFailureTargets(options, [failure]),
                );
              });
              break;
            }
            case "error": {
              hasError = true;
              showError((event.data as string) || "Agent retry failed");
              break;
            }
            case "done": {
              if (spriteChangeReceived) {
                qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
              }
              break;
            }
          }
        }
        if (!hasError && !imagePromptReviewRequested) {
          if (options?.lorebookKeeperBackfill) {
            toast.success("Lorebook Keeper backfill completed");
          } else if (agentResultCount === 0) {
            toast.warning("No agents ran. Add tracker agents to this chat or check their connection settings.");
          } else if (isTrackerRetry && trackerPatchCount === 0) {
            toast.warning("Agent run finished, but no tracker changes were returned.");
          } else {
            toast.success("Agent retry completed");
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return false;
        hasError = true;
        const msg =
          error instanceof Error
            ? (error as { cause?: unknown }).cause instanceof Error
              ? `${error.message}: ${(error as { cause?: Error }).cause!.message}`
              : error.message
            : "Agent retry failed";
        showError(msg);
      } finally {
        const stillOwner = useChatStore.getState().abortControllers.get(chatId) === abortController;
        if (stillOwner) {
          setProcessing(false, chatId);
          useChatStore.getState().setAbortController(chatId, null);
          useChatStore.getState().setBackgroundIllustration(chatId, false);
        }
        if (isTrackerRetry) useGameStateStore.getState().clearRefreshingChat(chatId);
        if (hasError && isActiveChat()) {
          void refreshMessagesAuthoritatively(qc, chatId);
        }
        if (shouldRefreshGameStateAfterGeneration(qc, chatId)) {
          void refreshVisibleGameStateAfterGeneration(chatId);
        }
      }
      return !hasError;
    },
    [
      addResult,
      addDebugEntry,
      addThoughtBubble,
      enqueueEchoMessages,
      enqueuePendingCardUpdate,
      enqueuePendingAgentWriteApproval,
      clearFailedAgentTypes,
      clearThoughtBubbles,
      setCyoaChoices,
      setYoutubePlay,
      setYoutubeVolume,
      setLocalMusicPlay,
      setLocalMusicVolume,
      setFailedAgentFailures,
      setProcessing,
      qc,
    ],
  );

  retryAgentsRef.current = retryAgents;

  return { generate, retryAgents };
}

/**
 * Format agent result data into a human-readable thought bubble string.
 * Every branch returns a string describing the outcome (failure, no-op, or completion).
 */
function formatRetryAgentActivityBubble(result: { data?: unknown }, isTrackerRetry: boolean): string | null {
  if (result.data && typeof result.data === "object" && (result.data as { parseError?: unknown }).parseError === true) {
    return "Failed: agent returned invalid JSON instead of the requested format.";
  }
  if (isTrackerRetry) {
    return "Completed, but no tracker changes were returned.";
  }
  return "Completed.";
}

function formatAgentBubble(agentType: string, agentName: string, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.parseError === true) {
    return "Failed: agent returned invalid JSON instead of the requested format.";
  }
  if (d.requiresApproval === true) {
    return `${agentName} proposed an update for review.`;
  }

  switch (agentType) {
    case "continuity": {
      if (d.editNeeded === false) return `✅ No edits needed`;
      const changes = (d.changes as any[]) ?? [];
      if (changes.length) return changes.map((c: any) => `🧭 ${c.description}`).join("\n");
      const text = d.text as string;
      if (text) {
        const trimmed = text.trim();
        const preview = trimmed.length > 120 ? trimmed.slice(0, 120) + "…" : trimmed;
        return `🧭 ${preview}`;
      }
      const issues = (d.issues as any[]) ?? [];
      if (!issues.length) return null;
      return issues
        .map((i: any) => {
          const description = typeof i.description === "string" ? i.description.trim() : "";
          const suggestion = typeof i.suggestion === "string" ? i.suggestion.trim() : "";
          const detail = suggestion ? `${description} Fix: ${suggestion}` : description;
          return `${i.severity === "error" ? "🔴" : "🟡"} ${detail}`;
        })
        .join("\n");
    }

    case "director": {
      if (d.overarchingArc) return `🎭 Secret plot arc updated`;
      const text =
        typeof d.direction === "string" ? d.direction.trim() : typeof d.text === "string" ? d.text.trim() : "";
      if (!text) return null;
      return text;
    }

    case "quest": {
      const updates = (d.updates as any[]) ?? [];
      if (!updates.length) return null;
      return updates.map((u: any) => `${u.action === "complete" ? "✅" : "📜"} ${u.questName}`).join("\n");
    }

    case "expression": {
      const expressions = (d.expressions as any[]) ?? [];
      if (!expressions.length) return null;
      return expressions
        .map((e: any) => {
          const t = e.transition && e.transition !== "crossfade" ? ` (${e.transition})` : "";
          return `🎭 ${e.characterName}: ${e.expression}${t}`;
        })
        .join("\n");
    }

    case "world-state": {
      // Compact summary of what changed
      const parts: string[] = [];
      if (d.location) parts.push(`📍 ${d.location}`);
      if (d.time) parts.push(`🕐 ${d.time}`);
      if (d.weather) parts.push(`🌤 ${d.weather}`);
      if (parts.length === 0) return null;
      return parts.join(" · ");
    }

    case "character-tracker": {
      const chars = (d.presentCharacters as any[]) ?? [];
      if (!chars.length) return null;
      return chars
        .map((c: any) => {
          const emoji = c.emoji ? `${c.emoji} ` : "👤 ";
          return `${emoji}${c.name}`;
        })
        .join(", ");
    }

    case "background": {
      const chosen = d.chosen as string | null;
      if (!chosen) return null;
      return `🖼️ ${chosen}`;
    }

    case "echo-chamber": {
      const reactions = (d.reactions as any[]) ?? [];
      if (!reactions.length) return null;
      return reactions.map((r: any) => `💬 ${r.characterName}: ${r.reaction}`).join("\n");
    }

    case "spotify": {
      const error = typeof d.error === "string" ? d.error.trim() : "";
      if (error) return `🎵 Music DJ could not run: ${error}`;
      if (d.parseError === true) {
        return "🎵 Music DJ ran, but did not return playable track details";
      }
      const action = d.action as string;
      const mood = (d.mood as string) ?? "";
      const display = typeof d.display === "string" ? d.display.trim() : "";
      if (action === "none") return mood ? `🎵 Keeping current track — ${mood}` : "🎵 Keeping current track";
      if (action === "play") {
        const localPath = typeof d.path === "string" ? d.path.trim() : "";
        if (localPath) {
          const trackName = typeof d.trackName === "string" ? d.trackName.trim() : "";
          const fallbackTitle =
            localPath
              .split("/")
              .pop()
              ?.replace(/\.[^.]+$/, "")
              .replace(/[-_]+/g, " ") || localPath;
          return `🎵 ${trackName || fallbackTitle}${mood ? ` — ${mood}` : ""}`;
        }
        // Support both array and singular formats
        const trackNames: string[] = Array.isArray(d.trackNames)
          ? (d.trackNames as string[])
          : d.trackName
            ? [d.trackName as string]
            : [];
        if (trackNames.length === 0) {
          if (display) return display;
          const youtubeQuery = typeof d.searchQuery === "string" ? d.searchQuery.trim() : "";
          if (youtubeQuery) return `🎵 ${youtubeQuery}${mood ? ` — ${mood}` : ""}`;
          const queued = typeof d.queued === "number" && Number.isFinite(d.queued) ? d.queued : 0;
          if (queued > 1) return `🎵 Queued ${queued} Spotify tracks${mood ? `: ${mood}` : ""}`;
          return mood ? `🎵 Music DJ started playback: ${mood}` : "🎵 Music DJ started playback";
        }
        if (trackNames.length === 1) {
          return `🎵 ${trackNames[0]}${mood ? ` — ${mood}` : ""}`;
        }
        const list = trackNames.map((t, i) => `${i + 1}. ${t}`).join("\n");
        return `🎵 Queued ${trackNames.length} tracks${mood ? ` — ${mood}` : ""}\n${list}`;
      }
      if (action === "volume") {
        return `🔊 Volume → ${d.volume}%${mood ? ` (${mood})` : ""}`;
      }
      return mood ? `🎵 ${mood}` : null;
    }

    case "prose-guardian": {
      if (d.editNeeded === false) return `✅ No edits needed`;
      const changes = (d.changes as any[]) ?? [];
      if (changes.length) return changes.map((c: any) => `🛡️ ${c.description}`).join("\n");
      const text = d.text as string;
      if (!text) return null;
      const trimmed = text.trim();
      const preview = trimmed.length > 120 ? trimmed.slice(0, 120) + "…" : trimmed;
      return `✍️ ${preview}`;
    }

    case "persona-stats": {
      const stats = (d.stats as any[]) ?? [];
      const status = d.status as string;
      if (!stats.length && !status) return null;
      const parts: string[] = [];
      if (status) parts.push(status);
      for (const s of stats) {
        parts.push(`${s.name}: ${s.value}/${s.max ?? 100}`);
      }
      return `📊 ${parts.join(" · ")}`;
    }

    case "illustrator": {
      const shouldGenerate = d.shouldGenerate as boolean;
      if (!shouldGenerate) return null;
      const style = d.style as string;
      const reason = d.reason as string;
      return `🎨 ${reason || "Generating scene illustration"}${style ? ` (${style})` : ""}`;
    }

    case "lorebook-keeper": {
      const updates = (d.updates as any[]) ?? [];
      if (!updates.length) return null;
      return updates.map((u: any) => `📖 ${u.action === "create" ? "New" : "Updated"}: ${u.entryName}`).join("\n");
    }

    case "knowledge-router": {
      const selectedEntries = Array.isArray(d.selectedEntries)
        ? (d.selectedEntries as Array<Record<string, unknown>>)
        : [];
      const candidateCount =
        typeof d.candidateCount === "number" && Number.isFinite(d.candidateCount) ? d.candidateCount : null;
      if (selectedEntries.length > 0) {
        const names = selectedEntries
          .map((entry) => (typeof entry.name === "string" ? entry.name.trim() : ""))
          .filter(Boolean);
        const list = names.slice(0, 5).join(", ");
        const suffix = names.length > 5 ? ` +${names.length - 5} more` : "";
        return `Selected ${selectedEntries.length}${candidateCount != null ? `/${candidateCount}` : ""} lorebook entries${list ? `: ${list}${suffix}` : ""}`;
      }
      if (candidateCount != null) return `Selected 0/${candidateCount} lorebook entries`;
      return "Selected 0 lorebook entries";
    }

    case "html": {
      const text = d.text as string;
      return `🎨 ${text || "HTML formatting active"}`;
    }

    default:
      return null;
  }
}
