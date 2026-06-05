import type { ChatMLMessage, GenerationParameters } from "../contracts/types/prompt";
import type { StorageGateway } from "../capabilities/storage";
import type { VisualAssetGateway } from "../capabilities/visual-assets";
import { llmParameters, loadChatMessages, requireRecord, resolveGenerationConnection } from "./context";
import { assembleGenerationPrompt } from "./prompt-assembly";
import { buildGenerationPromptPresetCandidates } from "./prompt-preset-selection";
import { generationInfoFromVisibleParameters, providerVisibleLlmParameters } from "./provider-visible-parameters";
import { boolish, isRecord, parseRecord, readNumber, readString, type JsonRecord } from "./runtime-records";

type PromptPreviewChoices = Record<string, string | string[]>;

export interface PromptPreviewInput {
  chatId: string;
  connectionId?: string | null;
  presetId?: string | null;
  choices?: PromptPreviewChoices | null;
  forCharacterId?: string | null;
  parameters?: Record<string, unknown> | null;
  beforeMessageId?: string | null;
}

export interface PromptPreviewResult {
  messages: ChatMLMessage[];
  previewMessages: ChatMLMessage[];
  parameters: Partial<GenerationParameters> | Record<string, unknown>;
  promptPresetId: string | null;
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

async function previewDefaultPromptId(storage: StorageGateway): Promise<string | null> {
  const prompts = await storage.list<JsonRecord>("prompts").catch(() => []);
  return (
    prompts
      .find((prompt) => boolish(prompt.isDefault ?? prompt.default, false))
      ?.id?.toString()
      .trim() || null
  );
}

async function promptPresetExists(storage: StorageGateway, presetId: string): Promise<boolean> {
  const full = await storage.promptFull?.<unknown>(presetId).catch(() => null);
  if (isRecord(full) && isRecord(full.preset)) return true;
  const direct = await storage.get("prompts", presetId).catch(() => null);
  if (isRecord(direct)) return true;
  const prompts = await storage.list<JsonRecord>("prompts").catch(() => []);
  return prompts.some((prompt) => readString(prompt.id).trim() === presetId);
}

async function previewChoicesPromptPresetId(
  storage: StorageGateway,
  chat: JsonRecord,
  connection: JsonRecord,
  request: { promptPresetId?: string | null },
): Promise<string | null> {
  const mode = readString(chat.mode || chat.chatMode, "conversation");
  const defaultPromptId = await previewDefaultPromptId(storage);
  const candidates = buildGenerationPromptPresetCandidates({
    chatMode: mode,
    chatPromptPresetId: chat.promptPresetId,
    connectionPromptPresetId: connection.promptPresetId,
    requestPromptPresetId: request.promptPresetId,
  }).map((candidate) => ({ id: candidate.id }));
  if (mode !== "conversation" && defaultPromptId && !candidates.some((candidate) => candidate.id === defaultPromptId)) {
    candidates.push({ id: defaultPromptId });
  }

  for (const candidate of candidates) {
    if (await promptPresetExists(storage, candidate.id)) return candidate.id;
  }
  return null;
}

export async function previewGenerationPrompt(
  storage: StorageGateway,
  input: PromptPreviewInput,
  visuals?: VisualAssetGateway,
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
  const choicesPromptPresetId = input.choices
    ? await previewChoicesPromptPresetId(storage, chat, connection, request)
    : null;
  const previewChat = {
    ...chat,
    ...(input.choices
      ? {
          promptPresetId: choicesPromptPresetId,
          metadata: {
            ...chatMetadata,
            presetChoices: input.choices,
          },
        }
      : {}),
  };
  const assembly = await assembleGenerationPrompt(storage, {
    chat: previewChat,
    storedMessages: previewMessages,
    connection,
    request,
    latestUserInput: "",
    visuals,
  });
  const parameters = llmParameters(connection, request, previewChat, assembly.parameters);
  const visibleParameters = providerVisibleLlmParameters(connection, parameters, { stream: true });
  const generationInfo = generationInfoFromVisibleParameters(connection, visibleParameters);
  return {
    messages: assembly.messages,
    previewMessages: assembly.previewMessages,
    parameters: visibleParameters,
    promptPresetId: assembly.promptPresetId,
    messageCount: assembly.messages.length,
    generationInfo: {
      model: generationInfo.model,
      provider: generationInfo.provider,
      temperature: generationInfo.temperature ?? null,
      maxTokens: generationInfo.maxTokens ?? null,
      topP: generationInfo.topP ?? null,
      topK: generationInfo.topK ?? null,
      frequencyPenalty: generationInfo.frequencyPenalty ?? null,
      presencePenalty: generationInfo.presencePenalty ?? null,
      showThoughts: generationInfo.showThoughts ?? null,
      reasoningEffort: generationInfo.reasoningEffort ?? null,
      verbosity: generationInfo.verbosity ?? null,
      serviceTier: generationInfo.serviceTier ?? null,
      assistantPrefill: generationInfo.assistantPrefill ?? null,
      tokensPrompt: null,
      tokensCompletion: null,
      tokensCachedPrompt: null,
      tokensCacheWritePrompt: null,
      durationMs: null,
      finishReason: null,
    },
  };
}
