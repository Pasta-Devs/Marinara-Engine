import type { FastifyInstance } from "fastify";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  isClaudeAdaptiveOnlyNoSamplingModel,
  resolveProviderReasoningEffort,
  resolveMacros,
  stripMacroComments,
  DEFAULT_CONVERSATION_PROMPT,
  DEFAULT_GAME_SYSTEM_PROMPT,
  normalizeGameStoryboardKeyframeCount,
  type GenerationParameterSendMap,
  type LorebookEntryTimingState,
} from "@marinara-engine/shared";
import { randomUUID } from "crypto";
import { createChatsStorage } from "../../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../../services/storage/connections.storage.js";
import { createPromptsStorage } from "../../services/storage/prompts.storage.js";
import { createCharactersStorage } from "../../services/storage/characters.storage.js";
import { createLorebooksStorage } from "../../services/storage/lorebooks.storage.js";
import { createRegexScriptsStorage } from "../../services/storage/regex-scripts.storage.js";
import {
  injectOwnerSpatialPrompt,
  projectGameSnapshotLocation,
  resolveOwnerSpatialProjection,
} from "../../services/spatial-context/projection.js";
import { buildImpersonateInstruction } from "../../services/conversation/impersonate-prompt.js";
import { processLorebooks } from "../../services/lorebook/index.js";
import { resolveLorebookScopeExclusions } from "../../services/lorebook/game-lorebook-scope.js";
import { injectAtDepth } from "../../services/lorebook/prompt-injector.js";
import { createLLMProvider } from "../../services/llm/provider-registry.js";
import { getLocalSidecarProvider } from "../../services/llm/local-sidecar.js";
import {
  assemblePrompt,
  buildPromptMacroContext,
  collectCharacterAdvancedPromptEntries,
  resolveCharacterAdvancedPromptIds,
  resolveCharacterMacroData,
  resolveMacrosWithVariableSnapshot,
  resolvePromptIdleDuration,
  resolvePromptLastGenerationType,
  resolvePromptMessageMacros,
  type AssemblerInput,
} from "../../services/prompt/index.js";
import { mergeAdjacentMessages } from "../../services/prompt/merger.js";
import { wrapContent } from "../../services/prompt/format-engine.js";
import { yieldToEventLoop, type BaseLLMProvider, type ChatMessage } from "../../services/llm/base-provider.js";
import {
  fitMessagesForModelAccess,
  mergeModelContextLimit,
  resolveModelAccessPolicy,
  resolveStoredModelContextLimit,
} from "../../services/generation/model-access-policy.js";
import { normalizeChatTopP } from "../../services/generation/generation-parameters.js";
import { applyAllSegmentEdits } from "../../services/game/segment-edits.js";
import { applyRegexScriptsToPromptMessages } from "../../services/regex/regex-application.js";
import { sendSseEvent, startSseReply } from "./sse.js";
import {
  appendReadableAttachmentsToContent,
  appendNonLeadingSystemMessagesToLastUser,
  buildGenerationGuideInstruction,
  createLocalSidecarGenerationConnection,
  dedupeLastMessageWrappers,
  extractFileAttachmentInputs,
  extractImageAttachmentDataUrls,
  findTrackerContextInsertIndex,
  formatConversationInstructionsForWrap,
  isMessageHiddenFromAI,
  mergeCustomParameters,
  normalizePromptWrapFormat,
  parseExtra,
  parseStoredGenerationParameters,
  prefixGroupIndividualHistorySpeakers,
  resolveActiveCharacterIds,
  resolveActivePersonaCandidate,
  resolvePromptCharacterIdsForTarget,
  resolveCharacterNameMap,
  resolveRegenerationGameStateAnchor,
  resolveProviderTopK,
  resolveRoleplayChatSummary,
  normalizeServiceTier,
  resolveVisibleGameStateAnchor,
  resolveBaseUrl,
  shouldEnableAgentsForGeneration,
  type PromptAttachment,
} from "../generate/generate-route-utils.js";
import { buildGenerationPromptPresetCandidates, type PromptPresetCandidateSource } from "./prompt-preset-selection.js";
import { createGameStateStorage, type GameStateVisibleAnchor } from "../../services/storage/game-state.storage.js";
import { buildCommittedTrackerContextBlock } from "../../services/generation/committed-tracker-context.js";
import { logger } from "../../lib/logger.js";
import { resolveGameGmPromptTemplate } from "../../services/generation/game-gm-prompt-runtime.js";

type WrapFormat = "xml" | "markdown" | "none";
type DryRunPromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
  files?: Array<{ type: string; data: string; filename?: string }>;
  contextKind?: "prompt" | "history" | "injection";
  characterId?: string | null;
  providerMetadata?: Record<string, unknown>;
};

function cardPromptText(value: unknown): string {
  return typeof value === "string" ? stripMacroComments(value).trim() : "";
}

function presetStringField(preset: Record<string, unknown> | null | undefined, field: string): string {
  const value = preset?.[field];
  return typeof value === "string" ? value.trim() : "";
}

function resolveDryRunLorebookGenerationTriggers(
  input: {
    impersonate?: boolean;
    regenerateMessageId?: unknown;
    userMessage?: string | null;
  },
  chatMode: string,
): string[] {
  const triggers = new Set<string>(["prompt_preview"]);
  triggers.add(chatMode === "game" ? "game" : chatMode);

  if (input.impersonate) {
    triggers.add("impersonate");
  } else if (typeof input.regenerateMessageId === "string" && input.regenerateMessageId.trim()) {
    triggers.add("swipe");
    triggers.add("regenerate");
  } else if (!input.userMessage?.trim()) {
    triggers.add("continue");
    triggers.add("autonomous");
  } else {
    triggers.add("chat");
  }

  return Array.from(triggers);
}

function resolveDryRunLorebookTokenBudget(chatMeta: Record<string, unknown>): number | undefined {
  const raw = chatMeta.lorebookTokenBudget ?? chatMeta.generationLorebookTokenBudget;
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : undefined;
}

async function loadLatestGameSnapshot(
  app: FastifyInstance,
  chatId: string,
  visibleAnchor?: GameStateVisibleAnchor | null,
  excludeMessageId?: string | null,
): Promise<any | null> {
  return createGameStateStorage(app.db).getForGeneration(chatId, {
    preferLatestVisible: true,
    visibleAnchor,
    excludeMessageId,
  });
}

function formatTrackersContextBlock(args: {
  wrapFormat: WrapFormat;
  snap: any;
  chatMeta: Record<string, unknown>;
  chatEnableAgents: boolean;
  activeAgentIds: string[];
}): string | null {
  return buildCommittedTrackerContextBlock({
    chatEnableAgents: args.chatEnableAgents,
    activeAgentIds: args.activeAgentIds,
    latestGameState: args.snap,
    chatMetadata: args.chatMeta,
    wrapFormat: args.wrapFormat,
  });
}

function injectTrackerContext(
  finalMessages: DryRunPromptMessage[],
  contextBlock: string,
  placement: "append" | "beforeLastHistoryMessage",
): DryRunPromptMessage[] {
  const trackerMessage = { role: "user" as const, content: contextBlock, contextKind: "injection" as const };

  if (placement === "append") {
    finalMessages.push(trackerMessage);
    return finalMessages;
  }

  dedupeLastMessageWrappers(finalMessages);
  finalMessages.splice(findTrackerContextInsertIndex(finalMessages), 0, trackerMessage);
  return finalMessages;
}

function wrapperMessages(
  wrapFormat: WrapFormat,
  key: string,
): { start?: { role: "system"; content: string }; end?: { role: "system"; content: string } } {
  if (wrapFormat === "none") return {};
  if (wrapFormat === "xml")
    return { start: { role: "system", content: `<${key}>` }, end: { role: "system", content: `</${key}>` } };
  // markdown
  return { start: { role: "system", content: `## ${key}` }, end: undefined };
}

function wrapConversationHistoryAndLastMessageInPlace(
  messages: DryRunPromptMessage[],
  wrapFormat: WrapFormat,
  opts?: { excludeTrailingImpersonationInstruction?: boolean },
): DryRunPromptMessage[] {
  if (wrapFormat === "none") return messages;

  // NOTE: This function is a dry-run-only compatibility shim for extensions.
  // - In preset mode, the real prompt pipeline may already apply <chat_history>/<last_message>.
  // - Extensions sometimes need the final assistant message wrapped too.
  // So we:
  //   1) Only apply <chat_history>/<last_message> if they are not already present.
  //   2) Additionally wrap the final assistant message (if present) as <last_assistant_message>.
  const hasPresetWrapping = (() => {
    for (const m of messages) {
      const c = m.content ?? "";
      if (wrapFormat === "xml") {
        if (
          c.includes("<last_message>") ||
          c.includes("</last_message>") ||
          c.includes("<chat_history>") ||
          c.includes("</chat_history>")
        ) {
          return true;
        }
      } else {
        if (c.includes("## Last Message") || c.includes("## Chat History")) return true;
      }
    }
    return false;
  })();

  const lastNonInstructionIdx = (() => {
    // Exclude the impersonation instruction (if present) from "conversation" selection.
    // This should be driven by explicit route state, not content sniffing.
    if (opts?.excludeTrailingImpersonationInstruction && messages.length > 0) {
      return messages.length - 2;
    }
    // No special exclusion requested: treat full array as the conversation candidate.
    return messages.length - 1;
  })();

  const historyIndexes = messages
    .map((message, index) => (message.contextKind === "history" ? index : -1))
    .filter((index) => index >= 0);
  const convoStart = historyIndexes[0] ?? messages.findIndex((m) => m.role === "user" || m.role === "assistant");
  if (convoStart < 0 || lastNonInstructionIdx < convoStart) return messages;

  const convoEnd = (() => {
    if (historyIndexes.length > 0) return historyIndexes[historyIndexes.length - 1]!;
    for (let i = lastNonInstructionIdx; i >= convoStart; i--) {
      const r = messages[i]!.role;
      if (r === "user" || r === "assistant") return i;
    }
    return -1;
  })();
  if (convoEnd < 0) return messages;

  // Copy so we can modify message contents in-place (aligns with marker-expander behavior).
  const out = messages.map((m) => ({ ...m }));

  const convoLen = convoEnd - convoStart + 1;
  if (convoLen <= 0) return messages;

  // Replicate the preset marker-expander behavior:
  // - Find the final message in the conversation slice
  // - Wrap everything before that as chat_history
  // - Wrap that final message as last_message
  const lastMessageIdx = convoEnd;
  const historyStartIdx = convoStart;
  const historyEndIdx = lastMessageIdx - 1;

  // 1) Only apply the normal preset-style wrapping if it's not already present.
  if (!hasPresetWrapping) {
    if (wrapFormat === "xml") {
      if (historyEndIdx >= historyStartIdx) {
        out[historyStartIdx] = {
          ...out[historyStartIdx]!,
          content: `<chat_history>\n${out[historyStartIdx]!.content}`,
        };
        out[historyEndIdx] = { ...out[historyEndIdx]!, content: `${out[historyEndIdx]!.content}\n</chat_history>` };
      }
      out[lastMessageIdx] = {
        ...out[lastMessageIdx]!,
        content: `<last_message>\n${out[lastMessageIdx]!.content}\n</last_message>`,
      };
    } else if (wrapFormat === "markdown") {
      if (historyEndIdx >= historyStartIdx) {
        out[historyStartIdx] = {
          ...out[historyStartIdx]!,
          content: `## Chat History\n${out[historyStartIdx]!.content}`,
        };
      }
      out[lastMessageIdx] = { ...out[lastMessageIdx]!, content: `## Last Message\n${out[lastMessageIdx]!.content}` };
    }
  }

  // 2) Additionally wrap the final assistant turn (if the conversation ends with assistant).
  // This is extension-oriented and intentionally NOT part of the standard preset pipeline.
  const lastMessageMarkerIdx = (() => {
    for (let i = convoStart; i <= convoEnd; i++) {
      const c = out[i]!.content ?? "";
      if (wrapFormat === "xml") {
        if (c.includes("<last_message>") || c.includes("</last_message>")) return i;
      } else {
        if (c.includes("## Last Message")) return i;
      }
    }
    return -1;
  })();

  const assistantToWrapIdx = (() => {
    // Older preset mode wrapped the last user message, leaving assistant replies unwrapped.
    // Prefer wrapping any assistant after an existing last_message marker for compatibility.
    if (lastMessageMarkerIdx >= 0) {
      for (let i = convoEnd; i > lastMessageMarkerIdx; i--) {
        if (out[i]!.role === "assistant") return i;
      }
      return -1;
    }

    // Fallback: if there is no last_message marker, just wrap the final assistant turn.
    if (out[convoEnd]!.role === "assistant") return convoEnd;
    return -1;
  })();

  if (assistantToWrapIdx >= 0) {
    // Pin the assistant message we intend to wrap, because we may reorder messages.
    const assistantMessageRef = out[assistantToWrapIdx]!;

    // If tracker context ended up *after* the assistant we want to tag, move it
    // before the assistant so the final assistant tag remains the tail of convo.
    //
    // This is a dry-run-only shim for extension previews. Tracker context is an
    // injection outside chat history, not part of the conversation slice.
    const isTrackerContextMessage = (m: DryRunPromptMessage): boolean => {
      if (m.contextKind !== "injection" && m.role !== "system") return false;
      const c = (m.content ?? "").trimStart();
      if (wrapFormat === "xml") return c.startsWith("<context>") || c.includes("\n</context>");
      return c.startsWith("# Context\n*(Established state as of the last message.");
    };

    const trackerIndicesAfter: number[] = [];
    for (let i = assistantToWrapIdx + 1; i < out.length; i++) {
      if (isTrackerContextMessage(out[i]!)) trackerIndicesAfter.push(i);
    }
    if (trackerIndicesAfter.length > 0) {
      const trackerMessages = trackerIndicesAfter.map((i) => out[i]!);
      for (let i = trackerIndicesAfter.length - 1; i >= 0; i--) {
        out.splice(trackerIndicesAfter[i]!, 1);
      }
      out.splice(assistantToWrapIdx, 0, ...trackerMessages);
    }

    const effectiveAssistantIdx = out.indexOf(assistantMessageRef);
    if (effectiveAssistantIdx < 0) return out;

    const c = out[effectiveAssistantIdx]!.content ?? "";
    const alreadyHasLastAssistant =
      wrapFormat === "xml"
        ? c.includes("<last_assistant_message>") || c.includes("</last_assistant_message>")
        : c.includes("## Last Assistant Message");
    if (!alreadyHasLastAssistant) {
      out[effectiveAssistantIdx] =
        wrapFormat === "xml"
          ? { ...out[effectiveAssistantIdx]!, content: `<last_assistant_message>\n${c}\n</last_assistant_message>` }
          : { ...out[effectiveAssistantIdx]!, content: `## Last Assistant Message\n${c}` };
    }
  }

  return out;
}

function parseJsonArray(value: unknown): unknown[] | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t ? t : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const anyRec = value as Record<string, unknown>;
    if (typeof anyRec.id === "string") {
      const t = anyRec.id.trim();
      return t ? t : null;
    }
  }
  return null;
}

function parsePresetChoices(value: unknown): Record<string, string | string[]> | null {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
      else if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[k] = v as string[];
    }
    return out;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function registerDryRunRoute(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const presets = createPromptsStorage(app.db);
  const chars = createCharactersStorage(app.db);
  const lorebooksStore = createLorebooksStorage(app.db);
  const regexScriptsStore = createRegexScriptsStorage(app.db);

  // Track active dry-runs so extensions can abort in-flight requests.
  // Keyed by runId to avoid colliding with normal /generate's chatId-keyed map.
  const activeDryRuns = new Map<string, { abortController: AbortController; chatId: string }>();

  /**
   * POST /api/generate/dryRun/abort
   * Abort an in-progress dry run by runId.
   */
  app.post("/dryRun/abort", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const runId = typeof body.runId === "string" ? body.runId : "";
    if (!runId) return reply.status(400).send({ error: "runId is required" });

    const entry = activeDryRuns.get(runId);
    if (!entry) return reply.send({ aborted: false, reason: "No active dry run for this runId" });

    // Optional safety: if chatId is provided, require it match.
    const chatId = typeof body.chatId === "string" ? body.chatId : "";
    if (chatId && chatId !== entry.chatId) {
      return reply.status(400).send({ error: "chatId does not match the active dry run" });
    }

    logger.info("[dryRun/abort] Explicit abort requested: runId=%s chatId=%s", runId, entry.chatId);
    entry.abortController.abort();
    activeDryRuns.delete(runId);
    return reply.send({ aborted: true });
  });

  /**
   * POST /api/generate/dryRun
   * Runs the generation pipeline without side effects.
   *
   * Key differences from POST /api/generate:
   * - Does NOT persist messages, swipes, generation info, or prompt caches
   * - Does NOT run agents or tools (no agent resolution, no tool calls)
   * - Does NOT post to Discord webhooks
   * - Optional prompt injections are explicit opt-ins (lorebook/trackers/summary)
   *
   * Response:
   * - If streaming=false (default): JSON { content: string }
   * - If streaming=true: SSE stream of {type:"token"} then {type:"result"} then {type:"done"}
   *
   * Impersonate (same semantics as POST /api/generate with impersonate: true):
   * - Set impersonate: true to generate the user's next in-character line without persisting anything.
   * - userMessage is optional *direction* only (not added as a chat history turn); matches the main route.
   */
  app.post("/dryRun", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const chatId = typeof body.chatId === "string" ? body.chatId : "";
    if (!chatId) return reply.status(400).send({ error: "chatId is required" });

    const chat = await chats.getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const impersonate = body.impersonate === true;
    const streaming = body.streaming === true;
    const returnPrompt = body.returnPrompt === true;
    const wrapLastMessage = body.wrapLastMessage === true;
    // Normalize injection flags (support extension legacy-ish aliases).
    const resolvedInjectLorebook = body.injectLorebook === true || body.injectLorebookInjection === true;
    const resolvedInjectTrackers = body.injectTrackers === true || body.injectTrackerMetadata === true;
    const resolvedInjectChatSummary = body.injectChatSummary === true || body.injectChatSummaryInjection === true;

    const skipPreset = body.skipPreset === true;
    const presetText = typeof body.presetText === "string" ? body.presetText : "";

    // Resolve connection (allow override; otherwise use chat connection)
    // Extensions may send connectionId like presetId (number or `{id}`); accept it.
    const impersonateConnectionOverride = impersonate ? asNonEmptyString(body.impersonateConnectionId) : null;
    const fallbackConnectionId = asNonEmptyString(body.connectionId) || ((chat.connectionId as string | null) ?? null);
    let connId = impersonateConnectionOverride || fallbackConnectionId;

    if (connId === "random") {
      const pool = await connections.listRandomPool();
      if (!pool.length) return reply.status(400).send({ error: "No connections are marked for the random pool" });
      const picked = pool[Math.floor(Math.random() * pool.length)];
      connId = picked.id;
    }

    if (!connId) return reply.status(400).send({ error: "No API connection configured for this chat" });
    const resolveDryRunConnection = async (connectionId: string) =>
      connectionId === LOCAL_SIDECAR_CONNECTION_ID
        ? createLocalSidecarGenerationConnection()
        : await connections.getWithKey(connectionId);

    let conn = await resolveDryRunConnection(connId);
    if (!conn && impersonateConnectionOverride && connId === impersonateConnectionOverride && fallbackConnectionId) {
      logger.warn(
        "[dryRun] Impersonate connection override %s was not found; falling back to chat/request connection",
        impersonateConnectionOverride,
      );
      connId = fallbackConnectionId;
      if (connId === "random") {
        const pool = await connections.listRandomPool();
        if (!pool.length) return reply.status(400).send({ error: "No connections are marked for the random pool" });
        const picked = pool[Math.floor(Math.random() * pool.length)];
        connId = picked.id;
      }
      conn = connId ? await resolveDryRunConnection(connId) : null;
    }
    if (!conn) return reply.status(400).send({ error: "API connection not found" });

    const baseUrl = resolveBaseUrl(conn);
    if (!baseUrl) return reply.status(400).send({ error: "No base URL configured for this connection" });

    const chatMeta = parseExtra(chat.metadata) as Record<string, unknown>;
    const modelAccessPolicy = resolveModelAccessPolicy({
      provider: conn.provider,
      model: conn.model,
      maxContext: conn.maxContext,
    });
    const { suppressModelParameters, connectionMaxContext } = modelAccessPolicy;

    // Minimal, safe parameter defaults (still allow chat-level overrides)
    let temperature: number | undefined = 1;
    let maxTokens = 2048;
    let topP: number | undefined = 1;
    let topK = 0;
    let minP = 0;
    let frequencyPenalty = 0;
    let presencePenalty = 0;
    let showThoughts = true;
    let reasoningEffort: "low" | "medium" | "high" | "xhigh" | "maximum" | null = null;
    let verbosity: "low" | "medium" | "high" | null = null;
    let serviceTier: "flex" | "priority" | null = null;
    let assistantPrefill = "";
    let customParameters: Record<string, unknown> = {};
    let enabledParameters: GenerationParameterSendMap | undefined;
    let effectiveMaxContext = modelAccessPolicy.effectiveMaxContext;

    const connectionParams = parseStoredGenerationParameters(conn.defaultParameters);
    const chatParams = parseStoredGenerationParameters(chatMeta.chatParameters);
    const applyParameterOverrides = (params: typeof connectionParams) => {
      if (!params) return;
      if (typeof params.temperature === "number") temperature = params.temperature;
      if (typeof params.maxTokens === "number") maxTokens = params.maxTokens;
      topP = normalizeChatTopP(params.topP) ?? topP;
      if (typeof params.topK === "number") topK = params.topK;
      if (typeof params.minP === "number") minP = params.minP;
      if (typeof params.frequencyPenalty === "number") frequencyPenalty = params.frequencyPenalty;
      if (typeof params.presencePenalty === "number") presencePenalty = params.presencePenalty;
      if (typeof params.showThoughts === "boolean") showThoughts = params.showThoughts;
      if (params.reasoningEffort !== undefined) reasoningEffort = params.reasoningEffort;
      if (params.verbosity !== undefined) verbosity = params.verbosity;
      if (params.serviceTier !== undefined) serviceTier = normalizeServiceTier(params.serviceTier);
      if (typeof params.assistantPrefill === "string") assistantPrefill = params.assistantPrefill;
      customParameters = mergeCustomParameters(customParameters, params.customParameters);
      if (params.enabledParameters) enabledParameters = { ...(enabledParameters ?? {}), ...params.enabledParameters };

      effectiveMaxContext = mergeModelContextLimit(
        modelAccessPolicy,
        effectiveMaxContext,
        resolveStoredModelContextLimit(modelAccessPolicy, params),
      );
    };

    // Pull existing messages, apply the same conversation-start + context limit filtering
    const allChatMessages = await chats.listMessages(chatId);
    const chatMode = (chat.mode as string) ?? "roleplay";
    const activeChatSummary = resolveRoleplayChatSummary(chatMode, chatMeta);
    const dryRunActiveAgentIds = Array.isArray(chatMeta.activeAgentIds) ? (chatMeta.activeAgentIds as string[]) : [];
    const dryRunChatEnableAgents = shouldEnableAgentsForGeneration({
      chatEnableAgents: chatMeta.enableAgents === true,
      impersonate,
      impersonateBlockAgents: false,
    });
    const supportsHiddenFromAI = chatMode === "conversation" || chatMode === "roleplay" || chatMode === "visual_novel";
    let startIdx = 0;
    for (let i = allChatMessages.length - 1; i >= 0; i--) {
      const extra = parseExtra(allChatMessages[i]!.extra);
      if (extra.isConversationStart) {
        startIdx = i;
        break;
      }
    }
    const scopedMessages = startIdx > 0 ? allChatMessages.slice(startIdx) : allChatMessages;
    let chatMessages = supportsHiddenFromAI
      ? scopedMessages.filter((message: any) => !isMessageHiddenFromAI(message))
      : scopedMessages;
    const regenerateMessageId =
      typeof body.regenerateMessageId === "string" && body.regenerateMessageId.trim()
        ? body.regenerateMessageId.trim()
        : null;
    const ownerSpatialProjection = await resolveOwnerSpatialProjection(
      chatId,
      regenerateMessageId ? { beforeMessageId: regenerateMessageId } : {},
    );
    const promptSpatialProjection =
      (ownerSpatialProjection?.ownerMode === "game" && chatMode === "game") ||
      (ownerSpatialProjection?.ownerMode === "roleplay" &&
        (chatMode === "roleplay" || chatMode === "visual_novel"))
        ? ownerSpatialProjection
        : null;
    const ownerSpatialLorebookEntryIds = promptSpatialProjection?.lorebookEntryIds ?? [];
    const visibleGameStateAnchor = regenerateMessageId
      ? resolveRegenerationGameStateAnchor(scopedMessages, regenerateMessageId)
      : resolveVisibleGameStateAnchor(allChatMessages);
    const contextMessageLimit = chatMeta.contextMessageLimit as number | null;
    if (contextMessageLimit && contextMessageLimit > 0 && chatMessages.length > contextMessageLimit) {
      chatMessages = chatMessages.slice(-contextMessageLimit);
    }

    // Ephemeral user line (normal dry run only): mirrors an unsaved "what if I said this" turn.
    // Impersonate mode does NOT add userMessage to history — same as POST /generate; direction is injected later.
    const userMessage = typeof body.userMessage === "string" ? body.userMessage : "";
    const lorebookGenerationTriggers = resolveDryRunLorebookGenerationTriggers(
      {
        impersonate,
        regenerateMessageId: body.regenerateMessageId,
        userMessage,
      },
      chatMode,
    );
    const promptLastGenerationType = resolvePromptLastGenerationType({
      autonomous: body.autonomous,
      impersonate,
      generationGuide: body.generationGuide,
      generationGuideSource: body.generationGuideSource,
      regenerateMessageId,
      turnGameBots: body.turnGameBots,
      userMessage,
      attachments: body.attachments,
    });
    const lorebookScopeExclusions = resolveLorebookScopeExclusions(chatMode, chatMeta);
    const lorebookTokenBudget = resolveDryRunLorebookTokenBudget(chatMeta);
    if (!impersonate && userMessage.trim()) {
      chatMessages = [
        ...chatMessages,
        {
          id: "__dryrun_user__",
          chatId,
          role: "user",
          characterId: null,
          content: userMessage,
          extra: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activeSwipeIndex: 0,
        } as any,
      ];
    }
    const promptIdleDuration = resolvePromptIdleDuration(chatMessages, { excludeMessageId: "__dryrun_user__" });

    const isGoogleProvider = conn.provider === "google" || conn.provider === "google_vertex";
    const excludePastReasoning = chatMeta.excludePastReasoning !== false;
    let mappedMessages = chatMessages.map((m: any) => {
      const extra = parseExtra(m.extra);
      const attachments = extra.attachments as PromptAttachment[] | undefined;
      const images = extractImageAttachmentDataUrls(attachments);
      const files = extractFileAttachmentInputs(attachments);
      const geminiParts =
        !excludePastReasoning && isGoogleProvider && m.role === "assistant" && extra.geminiParts
          ? { providerMetadata: { geminiParts: extra.geminiParts } }
          : {};
      return {
        id: typeof m.id === "string" ? m.id : null,
        role: m.role === "narrator" ? ("system" as const) : (m.role as "user" | "assistant" | "system"),
        content: appendReadableAttachmentsToContent((m.content as string) ?? "", attachments),
        contextKind: "history" as const,
        characterId: typeof m.characterId === "string" && m.characterId ? m.characterId : null,
        ...(images?.length ? { images } : {}),
        ...(files.length ? { files } : {}),
        ...geminiParts,
      };
    });

    // Game mode prompt preview must mirror real generation: segment edits/deletes
    // made in the VN log are model-visible overlays, even though raw DB messages
    // still contain the original GM output.
    if (chatMode === "game") {
      applyAllSegmentEdits(mappedMessages, chatMeta, chatMessages);
    }

    // Build prompt messages
    let finalMessages: DryRunPromptMessage[] = [];
    let wrapFormat: WrapFormat = "xml";

    // Optional: fine-grained prompt assembly (server-side) for extensions.
    // If provided, we skip preset assembly and build from selected components.
    const promptParts = isRecord(body.promptParts) ? (body.promptParts as Record<string, unknown>) : null;

    const allCharacterIds: string[] = (() => {
      try {
        return JSON.parse((chat as any).characterIds as string);
      } catch {
        return [];
      }
    })();
    const characterIds = resolveActiveCharacterIds(allCharacterIds, chatMeta, {
      mode: chatMode,
      allowEmpty: true,
    });
    const promptTargetCharacterId =
      typeof body.forCharacterId === "string" && characterIds.includes(body.forCharacterId)
        ? body.forCharacterId
        : null;
    const promptCharacterIds = resolvePromptCharacterIdsForTarget(characterIds, promptTargetCharacterId);

    // Persona resolution (same strategy as generation; read-only)
    let personaId: string | null = null;
    let personaName = "User";
    let personaDescription = "";
    let personaFields: Record<string, string> = {};
    let persona: any = null;
    try {
      const allPersonas = await chars.listPersonas();
      persona = resolveActivePersonaCandidate(allPersonas, (chat as any).personaId, chatMode);
      if (persona) {
        personaId = persona.id as string;
        personaName = persona.name;
        personaDescription = cardPromptText(persona.description);
        personaFields = {
          personality: cardPromptText(persona.personality),
          scenario: cardPromptText(persona.scenario),
          backstory: cardPromptText(persona.backstory),
          appearance: cardPromptText(persona.appearance),
        };
      }
    } catch {
      /* non-critical */
    }

    const promptPresetCandidates = skipPreset
      ? []
      : buildGenerationPromptPresetCandidates({
          chatMode,
          chatPromptPresetId: chat.promptPresetId,
          connectionPromptPresetId: conn.promptPresetId,
          impersonate,
          impersonatePromptPresetId: body.impersonatePresetId,
          requestPromptPresetId: body.presetId,
        });
    let effectivePresetId: string | null = null;
    let effectivePresetSource: PromptPresetCandidateSource | null = null;
    let effectivePreset: Awaited<ReturnType<typeof presets.getById>> | null = null;
    for (const candidate of promptPresetCandidates) {
      const candidatePreset = await presets.getById(candidate.id);
      if (candidatePreset) {
        effectivePresetId = candidate.id;
        effectivePresetSource = candidate.source;
        effectivePreset = candidatePreset;
        break;
      }
      if (candidate.source !== "chat") {
        logger.warn(
          "[dryRun] %s prompt preset override %s was not found; falling back to the next preset candidate",
          candidate.source,
          candidate.id,
        );
      }
    }

    // Choice selections are stored per-chat (chat metadata), not per prompt preset.
    // If a request or connection overrides the prompt preset, reusing the chat's stored selections can make it
    // *look* like the wrong preset is being used (because variables like {{role}} resolve to values
    // picked under a different preset).
    //
    // Dry-run-only behavior:
    // - If the request explicitly provides presetChoices, use those.
    // - Else if the effective preset differs from the chat's promptPresetId,
    //   start with empty choices so the assembler falls back to the preset's default/first options.
    // - Else fall back to the chat's stored selections.
    const requestChoices = parsePresetChoices((body as any).presetChoices);

    const chatChoicesFromMeta = (chatMeta.presetChoices ?? {}) as Record<string, string | string[]>;
    const isDifferentPresetOverride =
      !!effectivePresetId &&
      effectivePresetSource !== "chat" &&
      effectivePresetId !== ((chat.promptPresetId as string | null) ?? null);
    const presetDefaultChoices =
      isDifferentPresetOverride && effectivePreset ? parsePresetChoices(effectivePreset.defaultChoices) : null;

    const chatChoices: Record<string, string | string[]> =
      requestChoices ?? (isDifferentPresetOverride ? (presetDefaultChoices ?? {}) : chatChoicesFromMeta);
    const promptMacroContext = await buildPromptMacroContext({
      db: app.db,
      characterIds: promptCharacterIds,
      personaName,
      personaDescription,
      personaFields,
      variables: {
        gameStoryboardKeyframeCount: String(
          normalizeGameStoryboardKeyframeCount(chatMeta.gameStoryboardKeyframeCount),
        ),
      },
      groupScenarioOverrideText:
        typeof chatMeta.groupScenarioText === "string" && (chatMeta.groupScenarioText as string).trim()
          ? (chatMeta.groupScenarioText as string).trim()
          : null,
      lastInput: [...mappedMessages].reverse().find((message) => message.role === "user")?.content,
      chatId,
      model: conn.model,
      lastGenerationType: promptLastGenerationType,
      idleDuration: promptIdleDuration,
    });
    const historyMacroProfilesById = (await resolveCharacterMacroData(app.db, allCharacterIds)).profilesById;
    const resolveHistoryMessageMacros = <T extends { content: string; characterId?: string | null }>(
      messages: T[],
    ): T[] => resolvePromptMessageMacros(messages, promptMacroContext, historyMacroProfilesById);
    const resolvePromptMacros = (value: string) => resolveMacros(value, promptMacroContext);
    const resolvePromptMacrosForLorebook = (value: string) =>
      resolveMacrosWithVariableSnapshot(value, promptMacroContext);

    // Apply regex scripts to prompt messages (mirrors main /generate, but stays read-only).
    applyRegexScriptsToPromptMessages(mappedMessages, await regexScriptsStore.list(), {
      resolveMacros: (value, randomSeed) => resolveMacros(value, promptMacroContext, { trimResult: false, randomSeed }),
      targetCharacterId: promptTargetCharacterId,
    });

    for (const msg of mappedMessages) {
      msg.content = msg.content.replace(/\n([ \t]*\n){2,}/g, "\n\n");
    }
    mappedMessages = resolveHistoryMessageMacros(mappedMessages);
    const dryRunGroupChatMode = ((chatMeta.groupChatMode as string) ?? "merged") as string;
    const shouldPrefixGroupHistorySpeakers =
      chatMeta.groupSpeakerNamesInHistory === true &&
      characterIds.length > 1 &&
      chatMode !== "conversation" &&
      chatMode !== "game" &&
      dryRunGroupChatMode === "individual";
    if (shouldPrefixGroupHistorySpeakers) {
      const characterNamesById = await resolveCharacterNameMap(allCharacterIds, (id) => chars.getById(id));
      mappedMessages = prefixGroupIndividualHistorySpeakers(mappedMessages, {
        personaName,
        characterNamesById,
      });
    }
    promptMacroContext.lastInput = [...mappedMessages].reverse().find((message) => message.role === "user")?.content;

    const usePromptParts = !!promptParts;
    if (!usePromptParts && chatMode === "conversation" && effectivePreset) {
      wrapFormat = normalizePromptWrapFormat(effectivePreset.wrapFormat);
    }
    if (usePromptParts) {
      // Pick wrap format (default xml). If not specified, fall back to the selected preset's wrapFormat (if any).
      if (
        promptParts.wrapFormat === "markdown" ||
        promptParts.wrapFormat === "none" ||
        promptParts.wrapFormat === "xml"
      ) {
        wrapFormat = normalizePromptWrapFormat(promptParts.wrapFormat);
      } else if (effectivePreset) {
        wrapFormat = normalizePromptWrapFormat(effectivePreset.wrapFormat);
      }

      type PromptPartKey =
        | "extensionBlocks"
        | "presetText"
        | "persona"
        | "characters"
        | "chatSummary"
        | "lorebook"
        | "trackers"
        | "history"
        | "lastMessage";

      const includePersona = promptParts.includePersona !== false;
      const includeCharacters = promptParts.includeCharacters !== false;
      const includeHistory = promptParts.includeHistory !== false;
      const includeChatSummary = promptParts.includeChatSummary === true;
      const includeLorebook = promptParts.includeLorebook === true;
      const includeTrackers = promptParts.includeTrackers === true;

      const defaultOrder: PromptPartKey[] = [
        "extensionBlocks",
        "presetText",
        "persona",
        "characters",
        "chatSummary",
        "lorebook",
        "trackers",
        "history",
        "lastMessage",
      ];

      const requestedOrderRaw = Array.isArray(promptParts.order) ? (promptParts.order as unknown[]) : null;
      const requestedOrder = requestedOrderRaw
        ? requestedOrderRaw.map((k) => String(k)) // normalize
        : null;

      const order: PromptPartKey[] = (() => {
        if (!requestedOrder) return defaultOrder;
        const allowed = new Set<string>(defaultOrder);
        const seen = new Set<string>();
        const resolved: PromptPartKey[] = [];
        for (const k of requestedOrder) {
          if (!allowed.has(k) || seen.has(k)) continue;
          seen.add(k);
          resolved.push(k as PromptPartKey);
        }
        for (const k of defaultOrder) {
          if (seen.has(k)) continue;
          resolved.push(k);
        }
        return resolved;
      })();

      // Precompute parts (strings/messages) so order is deterministic.
      const extensionBlocksRaw =
        parseJsonArray(promptParts.extensionBlocks) ??
        (Array.isArray(promptParts.extensionBlocks) ? promptParts.extensionBlocks : null);
      const extensionBlocks: Array<{ role: "system"; content: string }> = [];
      if (extensionBlocksRaw?.length) {
        for (const block of extensionBlocksRaw) {
          if (!isRecord(block)) continue;
          const role = block.role === "system" ? "system" : null;
          const content = typeof block.content === "string" ? resolvePromptMacros(block.content) : "";
          if (role && content.trim()) extensionBlocks.push({ role: "system", content });
        }
      }

      const partsPresetText =
        typeof promptParts.presetText === "string" ? resolvePromptMacros(promptParts.presetText) : "";
      const presetTextBlock = partsPresetText.trim()
        ? wrapFormat === "xml"
          ? `<extension_preset>\n${partsPresetText.trim()}\n</extension_preset>`
          : wrapFormat === "markdown"
            ? `## Extension Preset\n${partsPresetText.trim()}`
            : partsPresetText.trim()
        : "";

      const personaBlock = (() => {
        if (!includePersona) return "";
        const personaLines: string[] = [];
        personaLines.push(`Name: ${personaName}`);
        const resolvedPersonaDescription = resolvePromptMacros(personaDescription);
        const resolvedPersonaPersonality = resolvePromptMacros(personaFields.personality ?? "");
        const resolvedPersonaScenario = resolvePromptMacros(personaFields.scenario ?? "");
        const resolvedPersonaBackstory = resolvePromptMacros(personaFields.backstory ?? "");
        const resolvedPersonaAppearance = resolvePromptMacros(personaFields.appearance ?? "");
        if (resolvedPersonaDescription.trim()) personaLines.push(`Description: ${resolvedPersonaDescription.trim()}`);
        if (resolvedPersonaPersonality.trim()) personaLines.push(`Personality: ${resolvedPersonaPersonality.trim()}`);
        if (resolvedPersonaScenario.trim()) personaLines.push(`Scenario: ${resolvedPersonaScenario.trim()}`);
        if (resolvedPersonaBackstory.trim()) personaLines.push(`Backstory: ${resolvedPersonaBackstory.trim()}`);
        if (resolvedPersonaAppearance.trim()) personaLines.push(`Appearance: ${resolvedPersonaAppearance.trim()}`);
        return wrapContent(personaLines.join("\n"), "Persona", wrapFormat).trim();
      })();

      const characterBlocks: string[] = [];
      if (includeCharacters && promptCharacterIds.length > 0) {
        const charRows = await Promise.all(promptCharacterIds.map((id) => chars.getById(id)));
        for (const row of charRows) {
          if (!row?.data) continue;
          try {
            const data = JSON.parse(row.data) as Record<string, unknown>;
            const name = typeof data.name === "string" ? data.name : "Character";
            const personality = cardPromptText(data.personality);
            const scenario = cardPromptText(data.scenario);
            const mesExample = cardPromptText(data.mes_example);
            const systemPrompt = cardPromptText(data.system_prompt);
            const postHistoryInstructions = cardPromptText(data.post_history_instructions);
            const extensions =
              data.extensions && typeof data.extensions === "object"
                ? (data.extensions as Record<string, unknown>)
                : {};
            const desc = cardPromptText(data.description);
            const characterMacroContext = {
              ...promptMacroContext,
              char: name,
              characterFields: {
                description: desc,
                personality,
                backstory: cardPromptText(extensions.backstory),
                appearance: cardPromptText(extensions.appearance),
                scenario,
                example: mesExample,
                systemPrompt,
                postHistoryInstructions,
              },
            };
            const resolveCharacterMacros = (value: string) => resolveMacros(value, characterMacroContext);

            const lines: string[] = [];
            const resolvedDesc = resolveCharacterMacros(desc);
            const resolvedPersonality = resolveCharacterMacros(personality);
            const resolvedScenario = resolveCharacterMacros(scenario);
            const resolvedMesExample = resolveCharacterMacros(mesExample);
            if (resolvedDesc.trim()) lines.push(resolvedDesc.trim());
            if (resolvedPersonality.trim()) lines.push(`Personality: ${resolvedPersonality.trim()}`);
            if (resolvedScenario.trim()) lines.push(`Scenario: ${resolvedScenario.trim()}`);
            if (resolvedMesExample.trim()) lines.push(`Example messages:\n${resolvedMesExample.trim()}`);

            const block = wrapContent(lines.join("\n\n"), name, wrapFormat).trim();
            if (block) characterBlocks.push(block);
          } catch {
            // ignore malformed character JSON
          }
        }
      }

      const chatSummaryBlock = (() => {
        if (!includeChatSummary) return "";
        const summary = activeChatSummary ?? "";
        if (!summary) return "";
        return wrapContent(summary, "Chat Summary", wrapFormat);
      })();

      const lorebookPayload = includeLorebook
        ? await (async () => {
            const activeLorebookIds: string[] = Array.isArray(chatMeta.activeLorebookIds)
              ? (chatMeta.activeLorebookIds as string[])
              : [];
            const scanMessages = mappedMessages.map((m) => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
            }));
            const lorebookResult = await processLorebooks(app.db, scanMessages, null, {
              chatId,
              characterIds: promptCharacterIds,
              personaId,
              activeLorebookIds,
              forcedEntryIds: ownerSpatialLorebookEntryIds,
              excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
              excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
              tokenBudget: lorebookTokenBudget,
              chatEmbedding: null,
              entryStateOverrides:
                (chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) &&
                typeof (chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) === "object"
                  ? ((chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) as Record<
                      string,
                      { ephemeral?: number | null; enabled?: boolean }
                    >)
                  : undefined,
              entryTimingStates:
                (chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) &&
                typeof (chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) === "object"
                  ? ((chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) as Record<
                      string,
                      LorebookEntryTimingState
                    >)
                  : undefined,
              generationTriggers: lorebookGenerationTriggers,
              previewOnly: true,
              resolveContent: resolvePromptMacrosForLorebook,
            });
            const loreContent = [lorebookResult.worldInfoBefore, lorebookResult.worldInfoAfter]
              .filter((content): content is string => typeof content === "string" && content.length > 0)
              .join("\n");
            const loreBlock = wrapContent(loreContent, "Lore", wrapFormat);
            return { loreBlock, depthEntries: lorebookResult.depthEntries };
          })()
        : { loreBlock: "", depthEntries: [] as any[] };

      const historyMessages = includeHistory
        ? (mappedMessages.map((m: any) => ({
            role: m.role,
            content: m.content,
            contextKind: "history" as const,
            characterId: m.characterId ?? null,
            ...(m.images ? { images: m.images } : {}),
            ...(m.files ? { files: m.files } : {}),
            ...(m.providerMetadata ? { providerMetadata: m.providerMetadata } : {}),
          })) as DryRunPromptMessage[])
        : [];

      const lastConvIdx = (() => {
        for (let i = historyMessages.length - 1; i >= 0; i--) {
          const r = historyMessages[i]?.role;
          if (r === "user" || r === "assistant") return i;
        }
        return -1;
      })();
      const historyWithoutLast = lastConvIdx >= 0 ? historyMessages.slice(0, lastConvIdx) : historyMessages;
      const lastMessage = lastConvIdx >= 0 ? historyMessages[lastConvIdx] : null;

      const trackersBlock = includeTrackers
        ? await (async () => {
            const snap = await loadLatestGameSnapshot(app, chatId, visibleGameStateAnchor, regenerateMessageId);
            if (!snap) return null;
            return formatTrackersContextBlock({
              wrapFormat,
              snap,
              chatMeta,
              chatEnableAgents: dryRunChatEnableAgents,
              activeAgentIds: dryRunActiveAgentIds,
            });
          })()
        : null;

      // Assemble finalMessages in the requested order.
      for (const key of order) {
        if (key === "extensionBlocks") {
          finalMessages.push(...extensionBlocks);
          continue;
        }
        if (key === "presetText") {
          if (presetTextBlock.trim()) finalMessages.push({ role: "system", content: presetTextBlock });
          continue;
        }
        if (key === "persona") {
          // `wrapContent(..., "Persona", "xml")` already yields a `<persona>` block.
          if (personaBlock) finalMessages.push({ role: "system", content: personaBlock });
          continue;
        }
        if (key === "characters") {
          if (characterBlocks.length > 0) {
            // In-place wrapping: attach characters markers onto the character blocks
            // instead of inserting extra system messages.
            const blocks = characterBlocks.map((block) => ({ role: "system" as const, content: block }));
            if (wrapFormat === "xml") {
              blocks[0] = { ...blocks[0]!, content: `<characters>\n${blocks[0]!.content}` };
              blocks[blocks.length - 1] = {
                ...blocks[blocks.length - 1]!,
                content: `${blocks[blocks.length - 1]!.content}\n</characters>`,
              };
            } else if (wrapFormat === "markdown") {
              blocks[0] = { ...blocks[0]!, content: `## characters\n${blocks[0]!.content}` };
            }
            finalMessages.push(...blocks);
          }
          continue;
        }
        if (key === "history") {
          if (historyWithoutLast.length > 0) {
            // In-place wrapping: attach chat_history markers onto the wrapped messages
            // instead of inserting extra system messages.
            const slice = historyWithoutLast.map((m) => ({ ...m }));
            if (wrapFormat === "xml") {
              slice[0] = { ...slice[0]!, content: `<chat_history>\n${slice[0]!.content}` };
              slice[slice.length - 1] = {
                ...slice[slice.length - 1]!,
                content: `${slice[slice.length - 1]!.content}\n</chat_history>`,
              };
            } else if (wrapFormat === "markdown") {
              slice[0] = { ...slice[0]!, content: `## Chat History\n${slice[0]!.content}` };
            }
            finalMessages.push(...slice);
          }
          continue;
        }
        if (key === "lastMessage") {
          if (lastMessage) {
            // In-place wrapping: attach last_message markers onto the message itself.
            const lm = { ...lastMessage };
            if (wrapFormat === "xml") {
              lm.content = `<last_message>\n${lm.content}\n</last_message>`;
            } else if (wrapFormat === "markdown") {
              lm.content = `## Last Message\n${lm.content}`;
            }
            finalMessages.push(lm);
          }
          continue;
        }
        if (key === "chatSummary") {
          if (!chatSummaryBlock) continue;
          const firstUserIdx = finalMessages.findIndex((m) => m.role === "user" || m.role === "assistant");
          const insertAt = firstUserIdx >= 0 ? firstUserIdx : finalMessages.length;
          finalMessages.splice(insertAt, 0, { role: "system", content: chatSummaryBlock });
          continue;
        }
        if (key === "lorebook") {
          if (!lorebookPayload.loreBlock) continue;
          const insertChunks: Array<{ role: "system"; content: string }> = [
            { role: "system", content: lorebookPayload.loreBlock },
          ];

          const firstUserIdx = finalMessages.findIndex((m) => m.role === "user" || m.role === "assistant");
          const insertAt = firstUserIdx >= 0 ? firstUserIdx : finalMessages.length;
          finalMessages.splice(insertAt, 0, ...insertChunks);
          // Depth entries only make sense if there are chat messages already present.
          if (
            lorebookPayload.depthEntries.length > 0 &&
            finalMessages.some((m) => m.role === "user" || m.role === "assistant")
          ) {
            finalMessages = injectAtDepth(finalMessages as any, lorebookPayload.depthEntries) as any;
          }
          continue;
        }
        if (key === "trackers") {
          if (!trackersBlock) continue;
          // Trackers already come out wrapped as `<context> ... </context>` when using XML.
          // In promptParts mode, honor `promptParts.order` strictly.
          finalMessages.push({ role: "user", content: trackersBlock, contextKind: "injection" });
          continue;
        }
      }
    } else if (effectivePresetId && effectivePreset && chatMode !== "conversation" && chatMode !== "game") {
      const preset = effectivePreset;
      wrapFormat = normalizePromptWrapFormat(preset.wrapFormat);
      const [sections, groups, choiceBlocks] = await Promise.all([
        presets.listSections(effectivePresetId),
        presets.listGroups(effectivePresetId),
        presets.listChoiceBlocksForPreset(effectivePresetId),
      ]);

      const assemblerInput: AssemblerInput = {
        db: app.db,
        preset: preset as any,
        sections: sections as any,
        groups: groups as any,
        choiceBlocks: choiceBlocks as any,
        chatChoices,
        chatId,
        characterIds: promptCharacterIds,
        personaId,
        personaName,
        personaDescription,
        personaFields,
        personaStats: (() => {
          if (!persona?.personaStats) return undefined;
          if (typeof persona.personaStats !== "string") return persona.personaStats;
          try {
            return JSON.parse(persona.personaStats);
          } catch {
            return undefined;
          }
        })(),
        chatMessages: mappedMessages,
        chatSummary: resolvedInjectChatSummary ? activeChatSummary : null,
        enableAgents: false,
        activeAgentIds: [],
        activeLorebookIds: resolvedInjectLorebook
          ? Array.isArray(chatMeta.activeLorebookIds)
            ? (chatMeta.activeLorebookIds as string[])
            : []
          : [],
        forcedLorebookEntryIds: ownerSpatialLorebookEntryIds,
        excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
        excludedLorebookSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
        chatEmbedding: null,
        entryStateOverrides:
          (chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) &&
          typeof (chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) === "object"
            ? ((chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) as Record<
                string,
                { ephemeral?: number | null; enabled?: boolean }
              >)
            : undefined,
        entryTimingStates:
          (chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) &&
          typeof (chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) === "object"
            ? ((chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) as Record<
                string,
                LorebookEntryTimingState
              >)
            : undefined,
        lorebookTokenBudget,
        generationTriggers: lorebookGenerationTriggers,
        previewOnly: true,
        groupScenarioOverrideText:
          typeof chatMeta.groupScenarioText === "string" && (chatMeta.groupScenarioText as string).trim()
            ? (chatMeta.groupScenarioText as string).trim()
            : null,
        lastGenerationType: promptLastGenerationType,
        idleDuration: promptIdleDuration,
        impersonate,
        preserveImpersonatePresetSections: impersonate && effectivePresetSource === "impersonate",
      };

      const assembled = await assemblePrompt(assemblerInput);
      finalMessages = assembled.messages;
      temperature = assembled.parameters.temperature;
      maxTokens = assembled.parameters.maxTokens;
      topP = assembled.parameters.topP ?? 1;
      topK = assembled.parameters.topK ?? 0;
      minP = assembled.parameters.minP ?? 0;
      frequencyPenalty = assembled.parameters.frequencyPenalty ?? 0;
      presencePenalty = assembled.parameters.presencePenalty ?? 0;
      showThoughts = assembled.parameters.showThoughts ?? true;
      reasoningEffort = assembled.parameters.reasoningEffort ?? null;
      verbosity = assembled.parameters.verbosity ?? null;
      serviceTier = assembled.parameters.serviceTier ?? null;
      assistantPrefill = assembled.parameters.assistantPrefill ?? "";
      customParameters = mergeCustomParameters(customParameters, assembled.parameters.customParameters);
      if (assembled.parameters.enabledParameters) {
        enabledParameters = { ...(enabledParameters ?? {}), ...assembled.parameters.enabledParameters };
      }

      effectiveMaxContext = mergeModelContextLimit(
        modelAccessPolicy,
        effectiveMaxContext,
        resolveStoredModelContextLimit(modelAccessPolicy, assembled.parameters),
      );
    }

    const modePresetParameters =
      effectivePresetId && effectivePreset && (chatMode === "conversation" || chatMode === "game")
        ? parseStoredGenerationParameters(effectivePreset.parameters)
        : null;
    if (modePresetParameters) applyParameterOverrides(modePresetParameters);
    applyParameterOverrides(connectionParams);
    applyParameterOverrides(chatParams);

    if (!finalMessages.length) {
      // No (or skipped) preset: fall back to raw mapped messages without any agent/tool behavior.
      finalMessages = mappedMessages.map((m: any) => ({
        role: m.role,
        content: m.content,
        ...(m.images ? { images: m.images } : {}),
        ...(m.files ? { files: m.files } : {}),
      }));
    }

    if (chatMode === "conversation") {
      const customPrompt =
        typeof chatMeta.customSystemPrompt === "string" && chatMeta.customSystemPrompt.trim()
          ? (chatMeta.customSystemPrompt as string)
          : null;
      const selectedConversationPrompt = presetStringField(
        effectivePreset as Record<string, unknown> | null,
        "conversationPrompt",
      );
      const characterNamesById = await resolveCharacterNameMap(promptCharacterIds, (id) => chars.getById(id));
      const charNameList =
        promptCharacterIds
          .map((id) => characterNamesById.get(id))
          .filter((name): name is string => Boolean(name))
          .join(", ") || "Character";
      const conversationPromptTemplate = customPrompt ?? (selectedConversationPrompt || DEFAULT_CONVERSATION_PROMPT);
      const renderedConversationPrompt = resolvePromptMacros(
        conversationPromptTemplate.replace(/\{\{charName\}\}/g, charNameList).replace(/\{\{userName\}\}/g, personaName),
      );
      finalMessages = [
        { role: "system", content: formatConversationInstructionsForWrap(renderedConversationPrompt, wrapFormat) },
        ...finalMessages,
      ];
    }
    if (chatMode === "game") {
      const setupConfig =
        chatMeta.gameSetupConfig &&
        typeof chatMeta.gameSetupConfig === "object" &&
        !Array.isArray(chatMeta.gameSetupConfig)
          ? (chatMeta.gameSetupConfig as Record<string, unknown>)
          : null;
      const customPrompt = resolveGameGmPromptTemplate(chatMeta, setupConfig);
      const selectedGamePrompt = presetStringField(effectivePreset as Record<string, unknown> | null, "gamePrompt");
      const gamePromptTemplate = customPrompt ?? (selectedGamePrompt || DEFAULT_GAME_SYSTEM_PROMPT);
      const renderedGamePrompt = resolvePromptMacros(gamePromptTemplate);
      finalMessages = [{ role: "system", content: renderedGamePrompt }, ...finalMessages];
    }

    // Optional injection: extension-provided preset text (read-only, explicit opt-in via presetText)
    if (presetText.trim()) {
      const block =
        wrapFormat === "xml"
          ? `<extension_preset>\n${presetText.trim()}\n</extension_preset>`
          : wrapFormat === "markdown"
            ? `## Extension Preset\n${presetText.trim()}`
            : presetText.trim();
      finalMessages = [{ role: "system", content: block }, ...finalMessages];
    }

    // Optional injection: chat summary (when not handled by preset assembler)
    if (!usePromptParts && !effectivePresetId && resolvedInjectChatSummary) {
      const summary = activeChatSummary ?? "";
      if (summary) {
        const block = wrapContent(summary, "Chat Summary", wrapFormat);
        const firstUserIdx = finalMessages.findIndex((m) => m.role === "user" || m.role === "assistant");
        const insertAt = firstUserIdx >= 0 ? firstUserIdx : finalMessages.length;
        finalMessages.splice(insertAt, 0, { role: "system", content: block });
      }
    }

    // Optional injection: lorebooks (only for preset-less flows; presets handle lorebooks in the assembler)
    if (!usePromptParts && !effectivePresetId && resolvedInjectLorebook) {
      const activeLorebookIds: string[] = Array.isArray(chatMeta.activeLorebookIds)
        ? (chatMeta.activeLorebookIds as string[])
        : [];
      const scanMessages = mappedMessages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));
      const lorebookResult = await processLorebooks(app.db, scanMessages, null, {
        chatId,
        characterIds: promptCharacterIds,
        personaId,
        forcedEntryIds: ownerSpatialLorebookEntryIds,
        activeLorebookIds,
        excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
        excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
        tokenBudget: lorebookTokenBudget,
        chatEmbedding: null,
        entryStateOverrides:
          (chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) &&
          typeof (chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) === "object"
            ? ((chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) as Record<
                string,
                { ephemeral?: number | null; enabled?: boolean }
              >)
            : undefined,
        entryTimingStates:
          (chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) &&
          typeof (chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) === "object"
            ? ((chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) as Record<
                string,
                LorebookEntryTimingState
              >)
            : undefined,
        generationTriggers: lorebookGenerationTriggers,
        previewOnly: true,
        resolveContent: resolvePromptMacrosForLorebook,
      });
      const loreContent = [lorebookResult.worldInfoBefore, lorebookResult.worldInfoAfter]
        .filter((content): content is string => typeof content === "string" && content.length > 0)
        .join("\n");
      if (loreContent) {
        const loreBlock = wrapContent(loreContent, "Lore", wrapFormat);
        const firstUserIdx = finalMessages.findIndex((m) => m.role === "user" || m.role === "assistant");
        const insertAt = firstUserIdx >= 0 ? firstUserIdx : finalMessages.length;
        finalMessages.splice(insertAt, 0, { role: "system", content: loreBlock });
      }
      if (lorebookResult.depthEntries.length > 0) {
        finalMessages = injectAtDepth(finalMessages as any, lorebookResult.depthEntries) as any;
      }
    }

    if (usePromptParts || !effectivePresetId) {
      const characterAdvancedPromptIds = resolveCharacterAdvancedPromptIds(
        promptCharacterIds,
        chatMode,
        chatMeta,
      );
      const characterAdvancedPromptEntries = await collectCharacterAdvancedPromptEntries(
        app.db,
        characterAdvancedPromptIds,
        promptMacroContext,
        wrapFormat,
      );
      if (characterAdvancedPromptEntries.length > 0) {
        finalMessages = injectAtDepth(finalMessages as any, characterAdvancedPromptEntries) as any;
      }
    }

    // Optional injection: tracker context (read-only snapshot)
    const resolvedInjectTrackersForRun = usePromptParts ? false : resolvedInjectTrackers;
    if (resolvedInjectTrackersForRun) {
      const snap = projectGameSnapshotLocation(
        await loadLatestGameSnapshot(app, chatId, visibleGameStateAnchor, regenerateMessageId),
        ownerSpatialProjection,
      );
      const contextBlock = snap
        ? formatTrackersContextBlock({
            wrapFormat,
            snap,
            chatMeta,
            chatEnableAgents: dryRunChatEnableAgents,
            activeAgentIds: dryRunActiveAgentIds,
          })
        : null;
      if (contextBlock) {
        finalMessages = injectTrackerContext(finalMessages, contextBlock, "beforeLastHistoryMessage");
      }
    }

    // ── Impersonate: same instruction block as POST /api/generate (no DB writes) ──
    if (impersonate) {
      const impersonateInstruction = buildImpersonateInstruction({
        customPrompt: body.impersonatePromptTemplate ?? chatMeta.impersonatePrompt,
        direction: userMessage,
        personaName,
        personaDescription,
      });
      finalMessages.push({ role: "user", content: impersonateInstruction });
    }

    // Optional post-processing: in preset mode, re-wrap conversation as <chat_history> + <last_message>.
    // This is a stopgap for extension debugging; promptParts mode already controls this via order.
    if (wrapLastMessage && !usePromptParts) {
      finalMessages = wrapConversationHistoryAndLastMessageInPlace(finalMessages, wrapFormat, {
        excludeTrailingImpersonationInstruction: impersonate,
      });
    }

    const generationGuideInstruction = buildGenerationGuideInstruction(body.generationGuide, promptMacroContext);
    if (generationGuideInstruction) {
      finalMessages.push({
        role: "system",
        content: generationGuideInstruction,
      });
    }

    if (typeof chatParams?.assistantPrefill === "string") assistantPrefill = chatParams.assistantPrefill;
    if (!impersonate && assistantPrefill.trim()) {
      // Mirror the real send path: the trailing edge is stripped because Anthropic
      // rejects a final assistant message ending in whitespace.
      finalMessages.push({ role: "assistant", content: assistantPrefill.trimEnd() });
    }
    finalMessages = injectOwnerSpatialPrompt(finalMessages, promptSpatialProjection);
    dedupeLastMessageWrappers(finalMessages);
    // Mirror the live route's provider-boundary macro guard so Peek Prompt is
    // both accurate and incapable of exposing late raw identity macros (#3704).
    finalMessages = resolveHistoryMessageMacros(finalMessages);

    // ── Parameter normalization (mirror /api/generate) ──
    const modelLower = (conn.model ?? "").toLowerCase();
    const providerLower = (conn.provider ?? "").toLowerCase();

    const resolvedEffort = resolveProviderReasoningEffort({
      provider: providerLower,
      model: modelLower,
      reasoningEffort,
    });

    // When reasoning effort is set, force showThoughts on (matches /generate's display behavior).
    if (resolvedEffort && !showThoughts) {
      showThoughts = true;
    }

    // enableThinking activates provider reasoning mode (separate from showing thoughts).
    const enableThinking = !!resolvedEffort;

    // ── Claude 4.5+ sampling parameter restrictions ──
    const modelLc = (conn.model ?? "").toLowerCase();

    // Claude adaptive-only models: ALL sampling params removed except max_tokens (provider returns 400 otherwise).
    const isClaudeNoSampling = isClaudeAdaptiveOnlyNoSamplingModel(modelLc);
    if (isClaudeNoSampling) {
      temperature = undefined;
      topP = undefined;
      topK = 0;
      frequencyPenalty = 0;
      presencePenalty = 0;
    }

    // Claude 4.5/4.6: only temperature supported — strip other sampling params.
    const isClaudeTemperatureOnly =
      !isClaudeNoSampling &&
      (/claude-(opus|sonnet)-4-[56]/.test(modelLc) || /claude-(opus|sonnet)-4\.[56]/.test(modelLc));
    if (isClaudeTemperatureOnly) {
      topP = undefined;
      topK = 0;
      frequencyPenalty = 0;
      presencePenalty = 0;
    }
    const providerTopK = resolveProviderTopK(topK);

    const provider: BaseLLMProvider =
      connId === LOCAL_SIDECAR_CONNECTION_ID
        ? (getLocalSidecarProvider() as any)
        : createLLMProvider(
            conn.provider,
            baseUrl,
            conn.apiKey,
            conn.maxContext,
            conn.openrouterProvider,
            conn.maxTokensOverride,
            conn.claudeFastMode === "true",
            conn.treatAsLocalEndpoint === "true",
            conn.defaultParameters,
          );

    // ── Mirror /api/generate: normalize + fit prompt to context ──

    // Collapse 3+ consecutive blank lines to save tokens
    for (const m of finalMessages) {
      m.content = m.content.replace(/\n([ \t]*\n){2,}/g, "\n\n");
    }

    const toProviderMessages = (
      promptMessages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
        contextKind?: "prompt" | "history" | "injection";
        images?: string[];
        files?: Array<{ type: string; data: string; filename?: string }>;
        providerMetadata?: Record<string, unknown>;
      }>,
    ): ChatMessage[] =>
      promptMessages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.contextKind ? { contextKind: message.contextKind } : {}),
        ...(message.images?.length ? { images: message.images } : {}),
        ...(message.files?.length ? { files: message.files } : {}),
        ...(message.providerMetadata ? { providerMetadata: message.providerMetadata } : {}),
      }));

    const prepareProviderMessages = (messages: ChatMessage[]): ChatMessage[] => {
      // Append mid-prompt system messages to the last user turn after context fitting.
      // This mirrors /api/generate while keeping prompt/injection blocks protected
      // during history trimming.
      return mergeAdjacentMessages(appendNonLeadingSystemMessagesToLastUser(messages) as any) as ChatMessage[];
    };

    const fit = fitMessagesForModelAccess({
      messages: toProviderMessages(finalMessages as any),
      policy: { ...modelAccessPolicy, effectiveMaxContext },
      maxTokens,
    });
    const providerMessages = prepareProviderMessages(fit.messages);
    const maxTokensForSend = fit.maxTokensForSend;

    // Prompt preview mode: return the exact prompt shape that would be sent.
    if (returnPrompt) {
      return reply.send({
        prompt: {
          messages: providerMessages.map((message) => ({
            role: message.role,
            content: message.content,
            ...(message.images?.length ? { images: message.images } : {}),
            ...(message.files?.length ? { files: message.files } : {}),
            ...(message.providerMetadata ? { providerMetadata: message.providerMetadata } : {}),
          })),
          wrapFormat,
        },
        parameters: {
          provider: conn.provider,
          model: conn.model,
          temperature: suppressModelParameters ? undefined : temperature,
          maxTokens: maxTokensForSend,
          maxContext: suppressModelParameters ? undefined : (effectiveMaxContext ?? connectionMaxContext),
          topP: suppressModelParameters ? undefined : topP,
          topK: suppressModelParameters ? undefined : providerTopK,
          frequencyPenalty: suppressModelParameters ? undefined : frequencyPenalty || undefined,
          presencePenalty: suppressModelParameters ? undefined : presencePenalty || undefined,
          enableThinking: suppressModelParameters ? undefined : enableThinking || undefined,
          reasoningEffort: suppressModelParameters ? undefined : resolvedEffort || undefined,
          verbosity: suppressModelParameters ? undefined : verbosity || undefined,
          serviceTier: serviceTier || undefined,
          showThoughts: showThoughts || undefined,
          assistantPrefill: assistantPrefill || undefined,
          customParameters: Object.keys(customParameters).length > 0 ? customParameters : undefined,
          suppressModelParameters: suppressModelParameters || undefined,
        },
      });
    }

    // SSE streaming mode
    if (streaming) {
      const abortController = new AbortController();
      const runId = randomUUID();
      activeDryRuns.set(runId, { abortController, chatId });

      const onClose = () => {
        abortController.abort();
        activeDryRuns.delete(runId);
      };
      req.raw.on("close", onClose);

      startSseReply(reply, { "X-Accel-Buffering": "no" });
      sendSseEvent(reply, { type: "dryrun_started", data: { runId } });

      // SSE keepalive: prevent proxy timeouts while waiting for first token.
      const keepaliveTimer = setInterval(() => {
        try {
          if (!reply.raw.destroyed) reply.raw.write(": keepalive\n\n");
        } catch {
          // Connection already closed — ignore
        }
      }, 15_000);

      const STREAM_CHUNK = 6;
      const STREAM_CHUNK_YIELD_EVERY = 64;
      let chunksSinceYield = 0;
      let full = "";
      const sendTokenTextChunked = async (text: string) => {
        for (let i = 0; i < text.length; i += STREAM_CHUNK) {
          sendSseEvent(reply, { type: "token", data: text.slice(i, i + STREAM_CHUNK) });
          chunksSinceYield += 1;
          if (chunksSinceYield % STREAM_CHUNK_YIELD_EVERY === 0) {
            await yieldToEventLoop();
          }
        }
      };
      const onToken = async (chunk: string) => {
        full += chunk;
        await sendTokenTextChunked(chunk);
      };

      try {
        const result = await provider.chatComplete(providerMessages as any, {
          model: conn.model,
          temperature,
          maxTokens: maxTokensForSend,
          maxContext: suppressModelParameters ? undefined : (effectiveMaxContext ?? connectionMaxContext),
          topP,
          topK: providerTopK,
          frequencyPenalty: frequencyPenalty || undefined,
          presencePenalty: presencePenalty || undefined,
          minP: minP || undefined,
          enableThinking,
          reasoningEffort: resolvedEffort ?? undefined,
          excludePastReasoning,
          verbosity: verbosity ?? undefined,
          serviceTier,
          customParameters,
          enabledParameters,
          suppressModelParameters,
          onToken,
          signal: abortController.signal,
        });

        if (result.content && !full.endsWith(result.content)) {
          await onToken(result.content);
        }

        sendSseEvent(reply, { type: "result", data: { content: full || result.content || "" } });
        sendSseEvent(reply, { type: "done", data: "" });
      } catch (err) {
        if (abortController.signal.aborted || (err && typeof err === "object" && (err as any).name === "AbortError")) {
          sendSseEvent(reply, { type: "aborted", data: "" });
          sendSseEvent(reply, { type: "done", data: "" });
          return;
        }
        logger.error(err, "[dryRun] Streaming generation failed");
        const message = err instanceof Error ? err.message : "Dry run generation failed";
        sendSseEvent(reply, { type: "error", data: message });
        sendSseEvent(reply, { type: "done", data: "" });
      } finally {
        req.raw.off("close", onClose);
        activeDryRuns.delete(runId);
        clearInterval(keepaliveTimer);
        reply.raw.end();
      }
      return;
    }

    // Non-streaming mode (default): allow aborts via runId, just like streaming.
    // Extensions can either:
    // - Provide `runId` in the request body, or
    // - Read it from the `x-dryrun-runid` response header and then call /dryRun/abort.
    const abortController = new AbortController();
    const providedRunId = typeof (body as any).runId === "string" ? ((body as any).runId as string).trim() : "";
    const runId = providedRunId || randomUUID();
    activeDryRuns.set(runId, { abortController, chatId });

    const onClose = () => {
      abortController.abort();
      activeDryRuns.delete(runId);
    };
    req.raw.on("close", onClose);

    reply.header("x-dryrun-runid", runId);

    try {
      const result = await provider.chatComplete(providerMessages as any, {
        model: conn.model,
        temperature,
        maxTokens: maxTokensForSend,
        maxContext: suppressModelParameters ? undefined : (effectiveMaxContext ?? connectionMaxContext),
        topP,
        topK: providerTopK,
        frequencyPenalty: frequencyPenalty || undefined,
        presencePenalty: presencePenalty || undefined,
        minP: minP || undefined,
        enableThinking,
        reasoningEffort: resolvedEffort ?? undefined,
        excludePastReasoning,
        verbosity: verbosity ?? undefined,
        serviceTier,
        customParameters,
        enabledParameters,
        suppressModelParameters,
        signal: abortController.signal,
      });

      return reply.send({
        content: (result.content ?? "").trimEnd(),
        runId,
      });
    } catch (err) {
      if (abortController.signal.aborted || (err && typeof err === "object" && (err as any).name === "AbortError")) {
        return reply.send({ aborted: true, runId });
      }
      logger.error(err, "[dryRun] Generation failed");
      const message = err instanceof Error ? err.message : "Dry run generation failed";
      return reply.status(500).send({ error: message, runId });
    } finally {
      req.raw.off("close", onClose);
      activeDryRuns.delete(runId);
    }
  });
}
