import { BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS, type AgentContext, type AgentResult } from "../contracts/types/agent";
import type { GameState } from "../contracts/types/game-state";
import type { EventGateway } from "../capabilities/events";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway, LlmMessage } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import type { GenerationGuideSource } from "../shared/text/generation-guide";
import { createGenerationAgentRuntime } from "./agent-runner";
import { persistConnectedCommandTags } from "./connected-commands";
import { llmParameters, loadChatMessages, requireRecord, resolveGenerationConnection } from "./context";
import {
  appendReadableAttachmentsToContent,
  extractImageAttachmentDataUrls,
  getAttachmentFilename,
  resolveRegenerationGameStateAnchor,
  resolveRegenerationGameStateFallbackMessageIds,
  resolveVisibleGameStateAnchor,
  shouldPreferLatestVisibleGameState,
  type PromptAttachment,
} from "./generate-route-utils";
import type { GenerationEvent } from "./generation-events";
import {
  applyGenerationReplayToRegenerateInput,
  buildGenerationReplay,
  normalizeGenerationReplay,
} from "./generation-replay";
import { assembleGenerationPrompt } from "./prompt-assembly";
import type { GenerationCharacterContext } from "./prompt-assembly";
import { applyRuntimeRegexScripts } from "./regex-runtime";
import { boolish, hiddenFromAi, isRecord, nowIso, parseRecord, readString, stringArray, type JsonRecord } from "./runtime-records";
import {
  commitTrackerSnapshotForTarget,
  createTrackerSnapshotReadContext,
  getTrackerSnapshotForTarget,
  persistTrackerSnapshotForTurn,
  resolveVisibleGameStateFallbackMessageIds,
  selectTrackerSnapshotForGeneration,
  trackerSnapshotTargetFromMessage,
} from "./tracker-snapshots";

export interface StartGenerationInput extends JsonRecord {
  chatId: string;
  connectionId?: string | null;
  message?: string;
  userMessage?: string | null;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  parameters?: Record<string, unknown>;
  promptPresetId?: string | null;
  generationGuide?: string | null;
  generationGuideSource?: GenerationGuideSource | null;
  regenerateMessageId?: string | null;
  impersonate?: boolean;
  impersonateBlockAgents?: boolean;
  impersonatePresetId?: string | null;
  impersonateConnectionId?: string | null;
  impersonatePromptTemplate?: string | null;
  forCharacterId?: string | null;
  mentionedCharacterNames?: string[];
  attachments?: PromptAttachment[];
  debugMode?: boolean;
  debugSink?: AgentContext["debugSink"];
}

export interface GenerationEngineDeps {
  storage: StorageGateway;
  llm: LlmGateway;
  integrations: IntegrationGateway;
  events?: EventGateway;
}

export interface RetryAgentsInput extends JsonRecord {
  chatId: string;
  connectionId?: string | null;
  agentTypes?: string[];
  options?: Record<string, unknown>;
}

interface PreparedUserInput {
  content: string;
  attachments: PromptAttachment[];
  images: string[];
  mentionedCharacterNames: string[];
}

const LOREBOOK_KEEPER_AGENT_TYPE = "lorebook-keeper";
const DEFAULT_LOREBOOK_KEEPER_RUN_INTERVAL = BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS[LOREBOOK_KEEPER_AGENT_TYPE] ?? 8;

const CONTINUE_ASSISTANT_RESPONSE_INSTRUCTION =
  "[Generation instruction: continue from the latest assistant message. Do not repeat or summarize the previous response; pick up naturally from where it stopped.]";

function inputUserMessage(input: StartGenerationInput): string {
  return readString(input.message) || readString(input.userMessage);
}

function inputAttachments(input: StartGenerationInput): PromptAttachment[] {
  return Array.isArray(input.attachments) ? input.attachments.filter(isRecord).map((attachment) => attachment as PromptAttachment) : [];
}

function assertChatCanGenerate(chat: JsonRecord) {
  const mode = readString(chat.mode || chat.chatMode);
  const metadata = parseRecord(chat.metadata);
  if (mode === "roleplay" && metadata.sceneStatus === "concluded") {
    throw new Error("This scene is concluded. Convert or reopen it before sending new messages.");
  }
}

function imageAttachmentNotes(attachments: PromptAttachment[]): string {
  const names = attachments
    .filter((attachment) => readString(attachment.type).toLowerCase().startsWith("image/"))
    .map(getAttachmentFilename);
  if (names.length === 0) return "";
  return names.map((name) => `[Attached image: ${name}]`).join("\n");
}

async function prepareUserInput(storage: StorageGateway, input: StartGenerationInput): Promise<PreparedUserInput> {
  const raw = inputUserMessage(input).trim();
  const attachments = inputAttachments(input);
  const images = extractImageAttachmentDataUrls(attachments);
  const mentionedCharacterNames = stringArray(input.mentionedCharacterNames).filter((name) => name.trim().length > 0);
  const regexed = raw ? await applyRuntimeRegexScripts(storage, "user_input", raw) : "";
  const withReadableAttachments = appendReadableAttachmentsToContent(regexed, attachments);
  const imageNotes = imageAttachmentNotes(attachments);
  return {
    content: [withReadableAttachments, imageNotes].filter((part) => part.trim().length > 0).join("\n\n"),
    attachments,
    images,
    mentionedCharacterNames,
  };
}

function shouldSaveUserMessage(input: StartGenerationInput, prepared: PreparedUserInput): boolean {
  return !!prepared.content.trim() && input.impersonate !== true && !readString(input.regenerateMessageId).trim();
}

async function saveUserMessage(
  storage: StorageGateway,
  input: StartGenerationInput,
  prepared: PreparedUserInput,
): Promise<unknown | null> {
  if (!shouldSaveUserMessage(input, prepared)) return null;
  const extra: Record<string, unknown> = {};
  if (prepared.attachments.length) extra.attachments = prepared.attachments;
  if (prepared.mentionedCharacterNames.length) extra.mentionedCharacterNames = prepared.mentionedCharacterNames;
  const generationReplay = buildGenerationReplay({
    userMessage: inputUserMessage(input) || null,
    impersonate: false,
    generationGuide: input.generationGuide,
    generationGuideSource: input.generationGuideSource,
    impersonatePresetId: readString(input.impersonatePresetId) || null,
    impersonateConnectionId: readString(input.impersonateConnectionId) || null,
    impersonateBlockAgents: input.impersonateBlockAgents === true,
    impersonatePromptTemplate: input.impersonatePromptTemplate,
  });
  if (generationReplay) extra.generationReplay = generationReplay;
  return storage.createChatMessage(input.chatId, {
    role: "user",
    content: prepared.content,
    extra,
  });
}

function savedUserMessageForTimeline(saved: unknown, chatId: string): JsonRecord | null {
  if (!isRecord(saved)) return null;
  if (!readString(saved.id).trim()) return null;
  if (readString(saved.chatId).trim() !== chatId) return null;
  if (readString(saved.role).trim() !== "user") return null;
  if (!readString(saved.content).trim()) return null;
  return saved;
}

async function inputWithStoredGenerationReplay(
  storage: StorageGateway,
  chatId: string,
  input: StartGenerationInput,
): Promise<StartGenerationInput> {
  const regenerateMessageId = readString(input.regenerateMessageId).trim();
  if (!regenerateMessageId) return input;

  const target = await storage.get("messages", regenerateMessageId).catch(() => null);
  if (!isRecord(target) || readString(target.chatId).trim() !== chatId) return input;

  const replay = normalizeGenerationReplay(parseRecord(target.extra).generationReplay);
  if (!replay) return input;

  const nextInput = { ...input };
  applyGenerationReplayToRegenerateInput(nextInput, replay);
  return nextInput;
}

function requestMessages(input: StartGenerationInput): LlmMessage[] | null {
  if (!Array.isArray(input.messages) || input.messages.length === 0) return null;
  return input.messages
    .map((message): LlmMessage => ({
      role: message.role === "system" || message.role === "assistant" ? message.role : "user",
      content: readString(message.content).trim(),
    }))
    .filter((message) => message.content.length > 0);
}

function withImageAttachments(messages: LlmMessage[], images: string[]): LlmMessage[] {
  if (images.length === 0 || messages.length === 0) return messages;
  const next = messages.map((message) => ({ ...message }));
  let targetIndex = -1;
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index]?.role === "user") {
      targetIndex = index;
      break;
    }
  }
  if (targetIndex < 0) {
    next.push({ role: "user", content: "", images });
  } else {
    next[targetIndex] = {
      ...next[targetIndex]!,
      images: [...(next[targetIndex]!.images ?? []), ...images],
    };
  }
  return next;
}

function directiveMessages(
  input: StartGenerationInput,
  characters: GenerationCharacterContext[],
  prepared: PreparedUserInput,
  options: { continueAssistantResponse?: boolean } = {},
): LlmMessage[] {
  const messages: LlmMessage[] = [];
  if (input.impersonate === true) {
    const template =
      readString(input.impersonatePromptTemplate).trim() ||
      "Write the next reply as the user's persona. Do not continue as the assistant or narrator.";
    messages.push({
      role: "user",
      content: [template, prepared.content.trim() ? `Direction:\n${prepared.content.trim()}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    });
    return messages;
  }

  const forCharacterId = readString(input.forCharacterId).trim();
  if (forCharacterId) {
    const character = characters.find((candidate) => candidate.id === forCharacterId);
    messages.push({
      role: "user",
      content: character?.name
        ? `[Generation instruction: respond as ${character.name}.]`
        : `[Generation instruction: respond as the requested character.]`,
    });
  }

  if (prepared.mentionedCharacterNames.length) {
    messages.push({
      role: "user",
      content: `[Generation instruction: the user's latest message explicitly mentioned ${prepared.mentionedCharacterNames.join(", ")}. Prioritize those character voices when selecting who responds.]`,
    });
  }
  if (options.continueAssistantResponse === true) {
    messages.push({
      role: "user",
      content: CONTINUE_ASSISTANT_RESPONSE_INSTRUCTION,
    });
  }
  return messages;
}

function visibleTranscript(messages: JsonRecord[]): string {
  return messages
    .filter((message) => !hiddenFromAi(message))
    .slice(-24)
    .map((message) => `${readString(message.role, "message")}: ${readString(message.content)}`)
    .join("\n");
}

function messagesBeforeRegenerationTarget(storedMessages: JsonRecord[], regenerateMessageId: string | null | undefined): JsonRecord[] {
  const targetId = readString(regenerateMessageId).trim();
  if (!targetId) return storedMessages;
  const targetIndex = storedMessages.findIndex((message) => readString(message.id) === targetId);
  return targetIndex >= 0 ? storedMessages.slice(0, targetIndex) : storedMessages;
}

function isPassiveGenerationRequest(input: StartGenerationInput, prepared: PreparedUserInput): boolean {
  return (
    input.impersonate !== true &&
    !readString(input.regenerateMessageId).trim() &&
    !readString(input.generationGuide).trim() &&
    !inputUserMessage(input).trim() &&
    !prepared.content.trim() &&
    prepared.attachments.length === 0
  );
}

function latestVisibleMessage(messages: JsonRecord[]): JsonRecord | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (hiddenFromAi(message)) continue;
    if (!readString(message.content).trim()) continue;
    return message;
  }
  return null;
}

function shouldContinueAssistantResponse(
  input: StartGenerationInput,
  prepared: PreparedUserInput,
  storedMessages: JsonRecord[],
): boolean {
  if (!isPassiveGenerationRequest(input, prepared)) return false;
  return readString(latestVisibleMessage(storedMessages)?.role) === "assistant";
}

function resultKey(result: AgentResult): string {
  return `${result.agentId}:${result.agentType}:${result.type}:${JSON.stringify(result.data)}`;
}

async function persistAgentResults(
  storage: StorageGateway,
  chatId: string,
  messageId: string | null,
  results: AgentResult[],
): Promise<void> {
  const seen = new Set<string>();
  for (const result of results) {
    const key = resultKey(result);
    if (seen.has(key)) continue;
    seen.add(key);
    await storage.create("agent-runs", {
      chatId,
      messageId,
      agentId: result.agentId,
      agentType: result.agentType,
      resultType: result.type,
      resultData: result.data as never,
      success: result.success,
      error: result.error,
      tokensUsed: result.tokensUsed,
      durationMs: result.durationMs,
      createdAt: nowIso(),
    });
  }
}

async function persistTrackerSnapshotSafely(
  storage: StorageGateway,
  chatId: string,
  targetMessage: unknown,
  results: AgentResult[],
  baseSnapshot?: GameState | null,
): Promise<void> {
  const target = trackerSnapshotTargetFromMessage(targetMessage);
  if (!target) return;
  try {
    await persistTrackerSnapshotForTurn(storage, chatId, target, results, { baseSnapshot });
  } catch (error) {
    console.warn("[generation] tracker snapshot persist failed", error);
  }
}

async function saveAssistantMessage(args: {
  storage: StorageGateway;
  chat: JsonRecord;
  input: StartGenerationInput;
  connection: JsonRecord;
  content: string;
  agentResults: AgentResult[];
  noteCount: number;
  attachments?: JsonRecord[];
  usage?: unknown;
}): Promise<unknown | null> {
  if (args.input.impersonate === true) return null;

  const regenerateMessageId = readString(args.input.regenerateMessageId).trim();
  const generationReplay = buildGenerationReplay(args.input);
  if (regenerateMessageId) {
    const saved = await args.storage.addChatMessageSwipe(args.input.chatId, regenerateMessageId, args.content);
    if (!generationReplay) return saved;
    return args.storage.patchChatMessageExtra(regenerateMessageId, { generationReplay });
  }

  const requestedCharacterId = readString(args.input.forCharacterId).trim();
  const chatCharacterIdList = stringArray(args.chat.characterIds);
  const chatCharacterIds = new Set(chatCharacterIdList);
  const characterId =
    requestedCharacterId && (chatCharacterIds.size === 0 || chatCharacterIds.has(requestedCharacterId))
      ? requestedCharacterId
      : chatCharacterIdList.length === 1
        ? chatCharacterIdList[0]!
      : null;

  return args.storage.createChatMessage(args.input.chatId, {
    role: "assistant",
    characterId,
    content: args.content,
    extra: {
      ...(args.attachments?.length ? { attachments: args.attachments } : {}),
      ...(generationReplay ? { generationReplay } : {}),
    },
    generationInfo: {
      connectionId: readString(args.connection.id) || null,
      model: readString(args.connection.model) || null,
      agentResults: args.agentResults.length,
      notes: args.noteCount,
      usage: args.usage ?? null,
    },
  });
}

function messageId(saved: unknown): string | null {
  return isRecord(saved) ? readString(saved.id) || null : null;
}

function targetAssistantMessage(messages: JsonRecord[], options: Record<string, unknown> = {}): JsonRecord | null {
  const requestedId = readString(options.forMessageId).trim();
  if (requestedId) {
    return messages.find((message) => readString(message.id) === requestedId) ?? null;
  }
  return [...messages].reverse().find((message) => readString(message.role) === "assistant") ?? null;
}

function messageIndex(messages: JsonRecord[], target: JsonRecord | null): number {
  const id = readString(target?.id).trim();
  if (!id) return -1;
  return messages.findIndex((message) => readString(message.id).trim() === id);
}

function messagesBeforeTarget(messages: JsonRecord[], target: JsonRecord | null): JsonRecord[] {
  const index = messageIndex(messages, target);
  return index >= 0 ? messages.slice(0, index) : messages;
}

function positiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value));
}

function lorebookKeeperReadBehind(chat: JsonRecord): number {
  return nonNegativeInteger(parseRecord(chat.metadata).lorebookKeeperReadBehindMessages, 0);
}

function agentType(agent: JsonRecord): string {
  return readString(agent.type || agent.agentType).trim();
}

function agentSettings(agent: JsonRecord): JsonRecord {
  return parseRecord(agent.settings);
}

function lorebookKeeperRunInterval(agent: JsonRecord | null): number {
  return positiveInteger(agent ? agentSettings(agent).runInterval : null, DEFAULT_LOREBOOK_KEEPER_RUN_INTERVAL);
}

function chatActiveAgentIds(chat: JsonRecord): Set<string> {
  return new Set(stringArray(parseRecord(chat.metadata).activeAgentIds).map((id) => id.trim()).filter(Boolean));
}

function chatHasLorebookKeeperEnabled(chat: JsonRecord, agent: JsonRecord): boolean {
  if (!boolish(agent.enabled, false) || agentType(agent) !== LOREBOOK_KEEPER_AGENT_TYPE) return false;
  const activeAgentIds = chatActiveAgentIds(chat);
  if (activeAgentIds.size > 0) {
    const id = readString(agent.id).trim();
    return activeAgentIds.has(LOREBOOK_KEEPER_AGENT_TYPE) || (id ? activeAgentIds.has(id) : false);
  }
  return boolish(parseRecord(chat.metadata).enableAgents, false);
}

async function lorebookKeeperAgent(storage: StorageGateway, chat: JsonRecord): Promise<JsonRecord | null> {
  const agents = await storage.list<JsonRecord>("agents").catch(() => []);
  return agents.find((agent) => chatHasLorebookKeeperEnabled(chat, agent)) ?? null;
}

async function successfulLorebookKeeperMessageIds(storage: StorageGateway, chatId: string): Promise<Set<string>> {
  const runs = await storage.list<JsonRecord>("agent-runs").catch(() => []);
  return new Set(
    runs
      .filter((run) => readString(run.chatId).trim() === chatId)
      .filter((run) => readString(run.agentType).trim() === LOREBOOK_KEEPER_AGENT_TYPE)
      .filter((run) => boolish(run.success, false))
      .map((run) => readString(run.messageId).trim())
      .filter(Boolean),
  );
}

interface LorebookKeeperTarget {
  message: JsonRecord;
}

function lorebookKeeperBackfillTargets(
  storedMessages: JsonRecord[],
  processedMessageIds: Set<string>,
  options: { readBehind: number; runInterval: number },
): LorebookKeeperTarget[] {
  const assistantMessages = storedMessages
    .filter((message) => !hiddenFromAi(message))
    .filter((message) => readString(message.role).trim() === "assistant")
    .filter((message) => readString(message.id).trim() && readString(message.content).trim());
  const eligibleCount = Math.max(0, assistantMessages.length - options.readBehind);
  const targets: LorebookKeeperTarget[] = [];

  for (let ordinal = options.runInterval; ordinal <= eligibleCount; ordinal += options.runInterval) {
    const message = assistantMessages[ordinal - 1]!;
    const id = readString(message.id).trim();
    if (processedMessageIds.has(id)) continue;
    targets.push({ message });
  }

  return targets;
}

function isLorebookKeeperBackfill(input: RetryAgentsInput): boolean {
  return (
    input.options?.lorebookKeeperBackfill === true &&
    Array.isArray(input.agentTypes) &&
    input.agentTypes.some((type) => readString(type).trim() === LOREBOOK_KEEPER_AGENT_TYPE)
  );
}

async function commitVisibleTrackerSnapshotSafely(
  storage: StorageGateway,
  chatId: string,
  messages: JsonRecord[],
): Promise<void> {
  try {
    await commitTrackerSnapshotForTarget(storage, chatId, resolveVisibleGameStateAnchor(messages));
  } catch (error) {
    console.warn("[generation] tracker snapshot commit failed", error);
  }
}

async function selectGenerationTrackerBaseline(
  storage: StorageGateway,
  chatId: string,
  input: StartGenerationInput,
  prepared: PreparedUserInput,
  storedMessages: JsonRecord[],
): Promise<GameState | null> {
  const regenerateMessageId = readString(input.regenerateMessageId).trim();
  const visibleAnchor = regenerateMessageId
    ? resolveRegenerationGameStateAnchor(storedMessages, regenerateMessageId)
    : resolveVisibleGameStateAnchor(storedMessages);
  return selectTrackerSnapshotForGeneration(storage, chatId, {
    preferLatestVisible: shouldPreferLatestVisibleGameState({
      attachments: prepared.attachments,
      impersonate: input.impersonate,
      regenerateMessageId,
      userMessage: inputUserMessage(input),
    }),
    visibleAnchor,
    excludeMessageId: regenerateMessageId || null,
    fallbackTargets:
      resolveRegenerationGameStateFallbackMessageIds(storedMessages, regenerateMessageId) ??
      resolveVisibleGameStateFallbackMessageIds(storedMessages),
  });
}

async function runGenerationAgentsForTarget(args: {
  deps: GenerationEngineDeps;
  input: RetryAgentsInput;
  chat: JsonRecord;
  connection: JsonRecord;
  storedMessages: JsonRecord[];
  target: JsonRecord | null;
  agentTypes: Set<string>;
  signal?: AbortSignal;
}): Promise<AgentResult[]> {
  const { deps, input, chat, connection, storedMessages, target, agentTypes, signal } = args;
  const chatId = readString(input.chatId).trim();
  const targetTrackerTarget = trackerSnapshotTargetFromMessage(target);
  const trackerReadContext = await createTrackerSnapshotReadContext(deps.storage, chatId);
  const retryBaseline = await selectTrackerSnapshotForGeneration(
    deps.storage,
    chatId,
    {
      preferLatestVisible: true,
      visibleAnchor: targetTrackerTarget,
      excludeMessageId: targetTrackerTarget?.messageId ?? null,
      fallbackTargets: resolveRegenerationGameStateFallbackMessageIds(
        storedMessages,
        targetTrackerTarget?.messageId,
      ),
    },
    trackerReadContext,
  );
  const targetSnapshot = await getTrackerSnapshotForTarget(
    deps.storage,
    chatId,
    targetTrackerTarget,
    trackerReadContext,
  );
  const chatForAgents = targetSnapshot ?? retryBaseline ? { ...chat, gameState: targetSnapshot ?? retryBaseline } : chat;
  const contextMessages = messagesBeforeTarget(storedMessages, target);
  const assembly = await assembleGenerationPrompt(deps.storage, {
    chat: chatForAgents,
    storedMessages: contextMessages,
    connection,
    request: input,
    latestUserInput: "",
  });
  const results: AgentResult[] = [];
  const runtime = await createGenerationAgentRuntime(
    { storage: deps.storage, llm: deps.llm, integrations: deps.integrations },
    {
      chat: chatForAgents,
      connection,
      storedMessages: contextMessages,
      characters: assembly.characters,
      persona: assembly.persona,
      activatedLorebookEntries: assembly.activatedLorebookEntries,
      chatSummary: assembly.chatSummary,
      agentTypes,
      signal,
    },
    (result) => results.push(result),
  );
  const mainResponse = target ? readString(target.content) : "";
  results.push(...(await runtime.runParallel()));
  results.push(...(await runtime.runPost(mainResponse)));

  const unique = new Map<string, AgentResult>();
  for (const result of [...runtime.preResults, ...results]) {
    unique.set(resultKey(result), result);
  }
  const finalResults = [...unique.values()];
  if (target) {
    await persistTrackerSnapshotSafely(deps.storage, chatId, target, finalResults, retryBaseline);
  }
  await persistAgentResults(deps.storage, chatId, target ? readString(target.id) || null : null, finalResults);
  return finalResults;
}

async function runLorebookKeeperBackfill(
  deps: GenerationEngineDeps,
  input: RetryAgentsInput,
  args: {
    chat: JsonRecord;
    connection: JsonRecord;
    storedMessages?: JsonRecord[];
    signal?: AbortSignal;
  },
): Promise<AgentResult[]> {
  const chatId = readString(input.chatId).trim();
  const agent = await lorebookKeeperAgent(deps.storage, args.chat);
  if (!agent) return [];

  const storedMessages = args.storedMessages ?? (await loadChatMessages(deps.storage, chatId));
  const processedMessageIds = await successfulLorebookKeeperMessageIds(deps.storage, chatId);
  const targets = lorebookKeeperBackfillTargets(storedMessages, processedMessageIds, {
    readBehind: lorebookKeeperReadBehind(args.chat),
    runInterval: lorebookKeeperRunInterval(agent),
  });
  const agentTypes = new Set([LOREBOOK_KEEPER_AGENT_TYPE]);
  const allResults: AgentResult[] = [];

  for (const target of targets) {
    allResults.push(
      ...(await runGenerationAgentsForTarget({
        deps,
        input,
        chat: args.chat,
        connection: args.connection,
        storedMessages,
        target: target.message,
        agentTypes,
        signal: args.signal,
      })),
    );
  }

  return allResults;
}

export async function retryGenerationAgents(
  deps: GenerationEngineDeps,
  input: RetryAgentsInput,
  signal?: AbortSignal,
): Promise<AgentResult[]> {
  const chatId = readString(input.chatId).trim();
  if (!chatId) throw new Error("chatId is required");
  const agentTypes = Array.isArray(input.agentTypes)
    ? new Set(input.agentTypes.map((type) => readString(type).trim()).filter(Boolean))
    : new Set<string>();
  const chat = requireRecord(await deps.storage.get("chats", chatId), "Chat");
  assertChatCanGenerate(chat);
  const connection = await resolveGenerationConnection(deps.storage, chat, input);
  const storedMessages = await loadChatMessages(deps.storage, chatId);
  if (isLorebookKeeperBackfill(input)) {
    return runLorebookKeeperBackfill(deps, input, { chat, connection, storedMessages, signal });
  }
  const target = targetAssistantMessage(storedMessages, input.options);
  return runGenerationAgentsForTarget({ deps, input, chat, connection, storedMessages, target, agentTypes, signal });
}

export async function* startGeneration(
  deps: GenerationEngineDeps,
  input: StartGenerationInput,
  signal?: AbortSignal,
): AsyncGenerator<GenerationEvent> {
  const chatId = readString(input.chatId).trim();
  if (!chatId) throw new Error("chatId is required");
  const chat = requireRecord(await deps.storage.get("chats", chatId), "Chat");
  assertChatCanGenerate(chat);
  input = await inputWithStoredGenerationReplay(deps.storage, chatId, input);

  yield { type: "phase", data: "Saving message..." };
  const preparedUserInput = await prepareUserInput(deps.storage, input);
  const savesUserMessage = shouldSaveUserMessage(input, preparedUserInput);
  let storedMessages: JsonRecord[] | null = null;
  if (savesUserMessage) {
    storedMessages = await loadChatMessages(deps.storage, chatId);
    await commitVisibleTrackerSnapshotSafely(deps.storage, chatId, storedMessages);
  }
  const savedUserMessage = await saveUserMessage(deps.storage, input, preparedUserInput);
  if (savedUserMessage) yield { type: "user_message", data: savedUserMessage };
  const connection = await resolveGenerationConnection(deps.storage, chat, input);
  if (savesUserMessage) {
    const savedTimelineMessage = savedUserMessageForTimeline(savedUserMessage, chatId);
    storedMessages = savedTimelineMessage
      ? [...(storedMessages ?? []), savedTimelineMessage]
      : await loadChatMessages(deps.storage, chatId);
  } else {
    storedMessages = await loadChatMessages(deps.storage, chatId);
  }
  const generationMessages = messagesBeforeRegenerationTarget(storedMessages, input.regenerateMessageId);
  const generationTrackerBaseline = await selectGenerationTrackerBaseline(
    deps.storage,
    chatId,
    input,
    preparedUserInput,
    storedMessages,
  );
  const chatForGeneration = generationTrackerBaseline ? { ...chat, gameState: generationTrackerBaseline } : chat;
  const directMessages = requestMessages(input);
  const agentEvents: AgentResult[] = [];
  const continueAssistantResponse = shouldContinueAssistantResponse(input, preparedUserInput, generationMessages);

  yield { type: "phase", data: "Assembling prompt..." };
  let prompt = directMessages;
  let assembly = await assembleGenerationPrompt(deps.storage, {
    chat: chatForGeneration,
    storedMessages: generationMessages,
    connection,
    request: input,
    latestUserInput: preparedUserInput.content || inputUserMessage(input),
  });

  if (!directMessages) {
    const agentsEnabled = input.impersonateBlockAgents !== true;
    yield { type: "phase", data: agentsEnabled ? "Running pre-generation agents..." : "Calling model..." };
    const runtime = agentsEnabled
      ? await createGenerationAgentRuntime(
          { storage: deps.storage, llm: deps.llm, integrations: deps.integrations },
          {
            chat: chatForGeneration,
            connection,
            storedMessages: generationMessages,
            characters: assembly.characters,
            persona: assembly.persona,
            activatedLorebookEntries: assembly.activatedLorebookEntries,
            chatSummary: assembly.chatSummary,
            debugMode: input.debugMode === true,
            debugSink: input.debugSink,
            signal,
          },
          (result) => agentEvents.push(result),
        )
      : null;
    for (const result of agentEvents) {
      yield { type: "agent_result", data: result };
    }
    agentEvents.length = 0;

    assembly = await assembleGenerationPrompt(deps.storage, {
      chat: chatForGeneration,
      storedMessages: generationMessages,
      connection,
      request: input,
      latestUserInput: preparedUserInput.content || inputUserMessage(input),
      agentData: runtime?.agentData,
    });
    prompt = withImageAttachments(
      [
        ...assembly.messages,
        ...directiveMessages(input, assembly.characters, preparedUserInput, { continueAssistantResponse }),
      ],
      preparedUserInput.images,
    );

    const parallelAgents = runtime?.runParallel() ?? Promise.resolve<AgentResult[]>([]);
    yield { type: "phase", data: "Calling model..." };
    let content = "";
    let usage: unknown = null;
    for await (const chunk of deps.llm.stream(
      {
        connectionId: readString(connection.id) || input.connectionId,
        model: readString(connection.model) || undefined,
        messages: [...prompt, generationGuide(input)].filter((message): message is LlmMessage => !!message),
        parameters: llmParameters(connection, input),
      },
      signal,
    )) {
      if (chunk.type === "token" && chunk.text) {
        content += chunk.text;
        yield { type: "token", data: chunk.text };
      } else if (chunk.type === "thinking" && chunk.text) {
        yield { type: "thinking", data: chunk.text };
      } else if (chunk.type === "usage") {
        usage = chunk.data ?? null;
      }
    }

    const parallelResults = await parallelAgents;
    const postResults = runtime ? await runtime.runPost(content) : [];
    for (const result of [...parallelResults, ...postResults, ...agentEvents]) {
      yield { type: "agent_result", data: result };
    }
    const allAgentResults = [...(runtime?.preResults ?? []), ...parallelResults, ...postResults, ...agentEvents];
    content = await applyRuntimeRegexScripts(deps.storage, "ai_output", content);
    const connected = await persistConnectedCommandTags(
      deps.storage,
      chat,
      content,
      deps.integrations,
      deps.llm,
      readString(connection.id) || input.connectionId || null,
    );
    for (const event of connected.events) yield event;
    const saved = connected.suppressAssistantMessage
      ? null
      : await saveAssistantMessage({
          storage: deps.storage,
          chat,
          input,
          connection,
          content: connected.displayContent,
          agentResults: allAgentResults,
          noteCount: connected.createdNotes.length + connected.executedCommands.length,
          attachments: connected.assistantAttachments,
          usage,
        });
    if (saved) await persistTrackerSnapshotSafely(deps.storage, chatId, saved, allAgentResults, generationTrackerBaseline);
    await persistAgentResults(deps.storage, chatId, messageId(saved), allAgentResults);
    if (saved) {
      const autoLorebookResults = await runLorebookKeeperBackfill(
        deps,
        {
          chatId,
          connectionId: readString(connection.id) || input.connectionId || null,
          agentTypes: [LOREBOOK_KEEPER_AGENT_TYPE],
          options: { lorebookKeeperBackfill: true },
        },
        { chat, connection, signal },
      );
      for (const result of autoLorebookResults) {
        yield { type: "agent_result", data: result };
      }
    }
    if (saved) yield { type: "assistant_message", data: saved };
    yield { type: "done", data: { transcript: visibleTranscript(generationMessages) } };
    return;
  }

  prompt = withImageAttachments(
    [...(prompt ?? []), ...directiveMessages(input, assembly.characters, preparedUserInput, { continueAssistantResponse })],
    preparedUserInput.images,
  );
  yield { type: "phase", data: "Calling model..." };
  let content = "";
  let usage: unknown = null;
  for await (const chunk of deps.llm.stream(
    {
      connectionId: readString(connection.id) || input.connectionId,
      model: readString(connection.model) || undefined,
      messages: [...(prompt ?? []), generationGuide(input)].filter((message): message is LlmMessage => !!message),
      parameters: llmParameters(connection, input),
    },
    signal,
  )) {
    if (chunk.type === "token" && chunk.text) {
      content += chunk.text;
      yield { type: "token", data: chunk.text };
    } else if (chunk.type === "thinking" && chunk.text) {
      yield { type: "thinking", data: chunk.text };
    } else if (chunk.type === "usage") {
      usage = chunk.data ?? null;
    }
  }
  content = await applyRuntimeRegexScripts(deps.storage, "ai_output", content);
  const connected = await persistConnectedCommandTags(
    deps.storage,
    chat,
    content,
    deps.integrations,
    deps.llm,
    readString(connection.id) || input.connectionId || null,
  );
  for (const event of connected.events) yield event;
  const saved = connected.suppressAssistantMessage
    ? null
    : await saveAssistantMessage({
        storage: deps.storage,
        chat,
        input,
        connection,
        content: connected.displayContent,
        agentResults: [],
        noteCount: connected.createdNotes.length + connected.executedCommands.length,
        attachments: connected.assistantAttachments,
        usage,
      });
  if (saved) {
    const autoLorebookResults = await runLorebookKeeperBackfill(
      deps,
      {
        chatId,
        connectionId: readString(connection.id) || input.connectionId || null,
        agentTypes: [LOREBOOK_KEEPER_AGENT_TYPE],
        options: { lorebookKeeperBackfill: true },
      },
      { chat, connection, signal },
    );
    for (const result of autoLorebookResults) {
      yield { type: "agent_result", data: result };
    }
  }
  if (saved) yield { type: "assistant_message", data: saved };
  yield { type: "done" };
}

function generationGuide(input: StartGenerationInput): LlmMessage | null {
  const guide = readString(input.generationGuide).trim();
  return guide ? { role: "user", content: guide } : null;
}
