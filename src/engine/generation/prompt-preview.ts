import type { ChatMLMessage, GenerationParameters } from "../contracts/types/prompt";
import type { StorageGateway } from "../capabilities/storage";
import { llmParameters, loadChatMessages, requireRecord, resolveGenerationConnection } from "./context";
import { assembleGenerationPrompt } from "./prompt-assembly";
import { readNumber, readString } from "./runtime-records";

export interface PromptPreviewInput {
  chatId: string;
  presetId?: string | null;
  choices?: Record<string, string> | null;
}

export interface PromptPreviewResult {
  messages: ChatMLMessage[];
  parameters: Partial<GenerationParameters> | Record<string, unknown>;
  messageCount: number;
  generationInfo: {
    model?: string;
    provider?: string;
    temperature?: number | null;
    maxTokens?: number | null;
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

export async function previewGenerationPrompt(
  storage: StorageGateway,
  input: PromptPreviewInput,
): Promise<PromptPreviewResult> {
  const chat = requireRecord(await storage.get("chats", input.chatId), "Chat");
  const connection = await resolveGenerationConnection(storage, chat, {});
  const storedMessages = await loadChatMessages(storage, input.chatId);
  const request = {
    promptPresetId: input.presetId ?? (readString(chat.promptPresetId) || null),
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
