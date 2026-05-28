import type { ChatMLMessage, GenerationParameters } from "../contracts/types/prompt";
import type { LlmMessage } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { fingerprintChatSummary } from "../shared/text/chat-summary-fingerprint";
import { llmParameters, loadChatMessages, requireRecord, resolveGenerationConnection } from "./context";
import { readCachedGenerationPrompt } from "./prompt-debug-cache";
import { assembleGenerationPrompt, chatSummaryForGeneration } from "./prompt-assembly";
import { hiddenFromAi, isRecord, parseRecord, readNumber, readString, type JsonRecord } from "./runtime-records";

export interface PromptPreviewInput {
  chatId: string;
  presetId?: string | null;
  choices?: Record<string, string> | null;
  forCharacterId?: string | null;
  messageId?: string | null;
}

export interface PromptPreviewResult {
  messages: Array<{ role: ChatMLMessage["role"] | LlmMessage["role"]; content: string }>;
  parameters: Partial<GenerationParameters> | Record<string, unknown> | null;
  messageCount: number;
  generationInfo: {
    model?: string;
    provider?: string;
    temperature?: number | null;
    maxTokens?: number | null;
    topP?: number | null;
    topK?: number | null;
    frequencyPenalty?: number | null;
    presencePenalty?: number | null;
    showThoughts?: boolean | null;
    reasoningEffort?: string | null;
    verbosity?: string | null;
    serviceTier?: string | null;
    assistantPrefill?: string | null;
    tokensPrompt?: number | null;
    tokensCompletion?: number | null;
    tokensCachedPrompt?: number | null;
    tokensCacheWritePrompt?: number | null;
    durationMs?: number | null;
    finishReason?: string | null;
  } | null;
}

function promptPreviewMessageLoadOptions(
  chat: Record<string, unknown>,
): Parameters<StorageGateway["listChatMessages"]>[1] {
  const chatLimit = readNumber(parseRecord(chat.metadata).contextMessageLimit, 0);
  const historyLimit = Math.max(1, Math.min(9999, chatLimit || 300));
  return { limit: Math.max(40, Math.min(340, historyLimit + 20)) };
}

async function cachedPromptPreview(
  storage: StorageGateway,
  chat: JsonRecord,
  storedMessages: JsonRecord[],
  input: PromptPreviewInput,
): Promise<PromptPreviewResult | null> {
  if (input.presetId || input.choices) return null;

  const currentFingerprint = fingerprintChatSummary(chatSummaryForGeneration(chat));
  const requestedMessageId = readString(input.messageId).trim();
  if (requestedMessageId) {
    const requested = await storage.get("messages", requestedMessageId).catch(() => null);
    if (isRecord(requested) && readString(requested.chatId).trim() === input.chatId) {
      const cached = readCachedGenerationPrompt(requested, currentFingerprint);
      if (cached) {
        return {
          messages: cached.messages,
          parameters: null,
          messageCount: cached.messages.length,
          generationInfo: cached.generationInfo,
        };
      }
    }
    return null;
  }

  const latestVisible = [...storedMessages].reverse().find((message) => !hiddenFromAi(message));
  if (!latestVisible || readString(latestVisible.role) !== "assistant") return null;

  const cached = readCachedGenerationPrompt(latestVisible, currentFingerprint);
  if (!cached) return null;
  return {
    messages: cached.messages,
    parameters: null,
    messageCount: cached.messages.length,
    generationInfo: cached.generationInfo,
  };
}

export async function previewGenerationPrompt(
  storage: StorageGateway,
  input: PromptPreviewInput,
): Promise<PromptPreviewResult> {
  const chat = requireRecord(await storage.get("chats", input.chatId), "Chat");
  const connection = await resolveGenerationConnection(storage, chat, {});
  const storedMessages = await loadChatMessages(storage, input.chatId, promptPreviewMessageLoadOptions(chat));
  const cached = await cachedPromptPreview(storage, chat, storedMessages, input);
  if (cached) return cached;

  const request = {
    promptPresetId: input.presetId ?? (readString(chat.promptPresetId) || null),
    forCharacterId: input.forCharacterId ?? null,
  };
  const previewChat = {
    ...chat,
    ...(input.choices ? { promptVariables: input.choices, variableValues: input.choices } : {}),
  };
  const assembly = await assembleGenerationPrompt(storage, {
    chat: previewChat,
    storedMessages,
    connection,
    request,
    latestUserInput: "",
  });
  const parameters = llmParameters(connection, {}, previewChat, assembly.parameters);
  return {
    messages: assembly.messages,
    parameters,
    messageCount: assembly.messages.length,
    generationInfo: {
      model: readString(connection.model) || undefined,
      provider: readString(connection.provider) || undefined,
      temperature: nullableNumber(parameters.temperature),
      maxTokens: nullableNumber(parameters.maxTokens ?? parameters.max_tokens),
      topP: nullableNumber(parameters.topP ?? parameters.top_p),
      topK: nullableNumber(parameters.topK ?? parameters.top_k),
      frequencyPenalty: nullableNumber(parameters.frequencyPenalty ?? parameters.frequency_penalty),
      presencePenalty: nullableNumber(parameters.presencePenalty ?? parameters.presence_penalty),
      showThoughts: typeof parameters.showThoughts === "boolean" ? parameters.showThoughts : null,
      reasoningEffort: typeof parameters.reasoningEffort === "string" ? parameters.reasoningEffort : null,
      verbosity: typeof parameters.verbosity === "string" ? parameters.verbosity : null,
      serviceTier: typeof parameters.serviceTier === "string" ? parameters.serviceTier : null,
      assistantPrefill: typeof parameters.assistantPrefill === "string" ? parameters.assistantPrefill : null,
      tokensPrompt: null,
      tokensCompletion: null,
      tokensCachedPrompt: null,
      tokensCacheWritePrompt: null,
      durationMs: null,
      finishReason: null,
    },
  };
}

function nullableNumber(value: unknown): number | null {
  const parsed = readNumber(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}
