import type { ChatMLMessage, GenerationParameters } from "../contracts/types/prompt";
import type { StorageGateway } from "../capabilities/storage";
import { llmParameters, loadChatMessages, requireRecord, resolveGenerationConnection } from "./context";
import { assembleGenerationPrompt } from "./prompt-assembly";
import { parseRecord, readNumber, readString } from "./runtime-records";

export interface PromptPreviewInput {
  chatId: string;
  connectionId?: string | null;
  presetId?: string | null;
  choices?: Record<string, string> | null;
  forCharacterId?: string | null;
  parameters?: Record<string, unknown> | null;
  beforeMessageId?: string | null;
}

export interface PromptPreviewResult {
  messages: ChatMLMessage[];
  previewMessages: ChatMLMessage[];
  parameters: Partial<GenerationParameters> | Record<string, unknown>;
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

export async function previewGenerationPrompt(
  storage: StorageGateway,
  input: PromptPreviewInput,
): Promise<PromptPreviewResult> {
  const chat = requireRecord(await storage.get("chats", input.chatId), "Chat");
  const connection = await resolveGenerationConnection(storage, chat, input);
  const storedMessages = await loadChatMessages(storage, input.chatId, promptPreviewMessageLoadOptions(chat));
  const beforeMessageId = readString(input.beforeMessageId).trim();
  const messageIndex = beforeMessageId
    ? storedMessages.findIndex((message) => readString(message.id).trim() === beforeMessageId)
    : -1;
  const previewMessages = messageIndex >= 0 ? storedMessages.slice(0, messageIndex) : storedMessages;
  const request = {
    promptPresetId: input.presetId ?? (readString(chat.promptPresetId) || null),
    forCharacterId: input.forCharacterId ?? null,
    parameters: input.parameters ?? null,
  };
  const chatMetadata = parseRecord(chat.metadata);
  const previewChat = {
    ...chat,
    ...(input.choices
      ? {
          metadata: {
            ...chatMetadata,
            presetChoices: input.choices,
          },
          promptVariables: input.choices,
          variableValues: input.choices,
        }
      : {}),
  };
  const assembly = await assembleGenerationPrompt(storage, {
    chat: previewChat,
    storedMessages: previewMessages,
    connection,
    request,
    latestUserInput: "",
  });
  const parameters = llmParameters(connection, request, previewChat, assembly.parameters);
  return {
    messages: assembly.messages,
    previewMessages: assembly.previewMessages,
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
