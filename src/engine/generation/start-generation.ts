import { BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS, type AgentContext, type AgentResult } from "../contracts/types/agent";
import type { GenerationPromptSnapshot, GenerationPromptSnapshotMessage } from "../contracts/types/chat";
import type { GameState } from "../contracts/types/game-state";
import type { EventGateway } from "../capabilities/events";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway, LlmMessage } from "../capabilities/llm";
import type { AddChatMessageSwipeOptions, StorageGateway } from "../capabilities/storage";
import type { SpriteOwnerType, VisualAssetGateway } from "../capabilities/visual-assets";
import { buildProseGuardianAvoidanceGuide, type GenerationGuideSource } from "../shared/text/generation-guide";
import { chatSummaryFingerprintMatches, fingerprintChatSummary } from "../shared/text/chat-summary-fingerprint";
import { collapseExcessBlankLines } from "../shared/text/newlines";
import { buildImpersonateInstruction } from "../modes/chat/commands/impersonate-prompt";
import { getConversationStatus } from "../modes/chat/autonomous/autonomous.service";
import { getBusyDelay, type WeekSchedule } from "../modes/chat/schedules/schedule.service";
import {
  activeCharacterIds,
  assertChatHasActiveCharacters,
  assertRequestedCharacterIsActive,
} from "./active-characters";
import { persistSecretPlotAgentMemory } from "./agent-memory-runtime";
import { createGenerationAgentRuntime } from "./agent-runner";
import { consumePendingConnectedInfluences, persistConnectedCommandTags } from "./connected-commands";
import { fitMessagesToContextWindow } from "./context-window";
import type { LLMToolCall } from "../generation-core/llm/base-provider";
import { createInlineThinkingStreamParser } from "../generation-core/llm/inline-thinking";
import {
  buildMainToolDefinitions,
  executeMainToolCall,
  normalizeToolCall,
  type MainToolDefinitions,
  type ToolRuntimeInput,
} from "./tools-runtime";
import { llmParameters, loadChatMessage, loadChatMessages, requireRecord, resolveGenerationConnection } from "./context";
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
  type GenerationReplay,
} from "./generation-replay";
import { loadPersonaSnapshotForChat } from "./persona-snapshot";
import { assembleGenerationPrompt, chatSummaryForGeneration } from "./prompt-assembly";
import type { GenerationCharacterContext, GenerationPersonaContext } from "./prompt-assembly";
import { generationInfoFromVisibleParameters, providerVisibleLlmParameters } from "./provider-visible-parameters";
import { applyRuntimeRegexScripts } from "./regex-runtime";
import {
  validateSpriteExpressionEntries,
  type AvailableSpriteCharacter,
  type SpriteExpressionEntry,
} from "./sprite-expression-validation";
import {
  boolish,
  hiddenFromAi,
  isRecord,
  nowIso,
  parseRecord,
  readNumber,
  readString,
  stringArray,
  type JsonRecord,
} from "./runtime-records";
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
  /**
   * IANA timezone resolved on the client (e.g. via
   * `Intl.DateTimeFormat().resolvedOptions().timeZone`). When set, prompt-time
   * macros like {{date}} and {{time}} resolve in this zone instead of UTC.
   * A persisted per-chat `metadata.promptTimeZone` takes precedence.
   */
  userTimeZone?: string;
  imagePromptSettings?: {
    includeAppearances?: boolean;
    format?: "descriptive" | "tags";
  };
  debugMode?: boolean;
  debugSink?: AgentContext["debugSink"];
  hideAutomatedSummarySourceMessages?: boolean;
  agentInjectionOverrides?: AgentInjectionOverride[];
}

export interface GenerationEngineDeps {
  storage: StorageGateway;
  llm: LlmGateway;
  integrations: IntegrationGateway;
  visuals?: VisualAssetGateway;
  events?: EventGateway;
}

export interface RetryAgentsInput extends JsonRecord {
  chatId: string;
  connectionId?: string | null;
  agentTypes?: string[];
  hideAutomatedSummarySourceMessages?: boolean;
  imagePromptSettings?: StartGenerationInput["imagePromptSettings"];
  options?: Record<string, unknown>;
}

interface PreparedUserInput {
  content: string;
  attachments: PromptAttachment[];
  images: string[];
  mentionedCharacterNames: string[];
}

interface AgentInjectionOverride {
  agentType: string;
  agentName?: string;
  text: string;
}

interface CyoaChoice {
  label: string;
  text: string;
}

const DEFAULT_GENERATION_HISTORY_LIMIT = 300;
const GENERATION_MESSAGE_LOAD_MARGIN = 20;
const MIN_GENERATION_MESSAGE_LOAD_LIMIT = 40;
const MAX_GENERATION_MESSAGE_LOAD_LIMIT = DEFAULT_GENERATION_HISTORY_LIMIT + GENERATION_MESSAGE_LOAD_MARGIN;
const LOREBOOK_KEEPER_BACKFILL_TARGET_SCAN_FIELDS = ["id", "chatId", "role", "extra", "createdAt"];

const LOREBOOK_KEEPER_AGENT_TYPE = "lorebook-keeper";
const DEFAULT_LOREBOOK_KEEPER_RUN_INTERVAL = BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS[LOREBOOK_KEEPER_AGENT_TYPE] ?? 8;

const CONTINUE_ASSISTANT_RESPONSE_INSTRUCTION =
  "[Generation instruction: continue from the latest assistant message. Do not repeat or summarize the previous response; pick up naturally from where it stopped.]";

type InternalStartGenerationOptions = {
  groupTurnChild?: boolean;
  latestUserInput?: string | null;
  skipUserMessageSave?: boolean;
};

const internalStartGenerationOptions = new WeakMap<StartGenerationInput, InternalStartGenerationOptions>();

type MainGenerationPromptSnapshot = Pick<
  GenerationPromptSnapshot,
  "messages" | "parameters" | "tools" | "promptPresetId"
>;

function abortGenerationError(): Error {
  return Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortGenerationError();
}

function inputUserMessage(input: StartGenerationInput): string {
  return collapseExcessBlankLines(readString(input.message) || readString(input.userMessage));
}

function normalizedAgentInjectionOverrides(input: StartGenerationInput): AgentInjectionOverride[] {
  if (!Array.isArray(input.agentInjectionOverrides)) return [];
  const overrides: AgentInjectionOverride[] = [];
  for (const entry of input.agentInjectionOverrides) {
    if (!isRecord(entry)) continue;
    const agentType = readString(entry.agentType).trim();
    const text = readString(entry.text).trim();
    if (!agentType || !text) continue;
    const agentName = readString(entry.agentName).trim();
    overrides.push({ agentType, ...(agentName ? { agentName } : {}), text });
  }
  return overrides;
}

function shouldPauseForAgentInjectionReview(
  chat: JsonRecord,
  input: StartGenerationInput,
  injections: AgentInjectionOverride[],
): boolean {
  if (normalizedAgentInjectionOverrides(input).length > 0) return false;
  if (injections.length === 0) return false;
  return parseRecord(chat.metadata).reviewWriterAgentOutputs === true;
}

function generationEmbeddingSource(llm: LlmGateway, connection: JsonRecord) {
  if (!llm.embed) return null;
  const connectionId = readString(connection.id).trim() || null;
  const model = readString(connection.embeddingModel).trim() || null;
  return {
    embed: (texts: string[]) =>
      llm.embed!({
        texts,
        connectionId,
        model,
      }),
  };
}

function inputAttachments(input: StartGenerationInput): PromptAttachment[] {
  return Array.isArray(input.attachments)
    ? input.attachments.filter(isRecord).map((attachment) => attachment as PromptAttachment)
    : [];
}

function assertChatCanGenerate(chat: JsonRecord, input?: { forCharacterId?: unknown }) {
  const mode = readString(chat.mode || chat.chatMode);
  const metadata = parseRecord(chat.metadata);
  if (mode === "roleplay" && metadata.sceneStatus === "concluded") {
    throw new Error("This scene is concluded. Convert or reopen it before sending new messages.");
  }
  assertChatHasActiveCharacters(chat);
  assertRequestedCharacterIsActive(chat, input?.forCharacterId);
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
    content: collapseExcessBlankLines(
      [withReadableAttachments, imageNotes].filter((part) => part.trim().length > 0).join("\n\n"),
    ),
    attachments,
    images,
    mentionedCharacterNames,
  };
}

function shouldSaveUserMessage(
  input: StartGenerationInput,
  prepared: PreparedUserInput,
  internalOptions: InternalStartGenerationOptions = {},
): boolean {
  if (internalOptions.skipUserMessageSave === true) return false;
  return !!prepared.content.trim() && input.impersonate !== true && !readString(input.regenerateMessageId).trim();
}

async function saveUserMessage(
  storage: StorageGateway,
  chat: JsonRecord,
  input: StartGenerationInput,
  prepared: PreparedUserInput,
  internalOptions: InternalStartGenerationOptions = {},
): Promise<unknown | null> {
  if (!shouldSaveUserMessage(input, prepared, internalOptions)) return null;
  const extra: Record<string, unknown> = {};
  if (prepared.attachments.length) extra.attachments = prepared.attachments;
  if (prepared.mentionedCharacterNames.length) extra.mentionedCharacterNames = prepared.mentionedCharacterNames;
  const personaSnapshot = await loadPersonaSnapshotForChat(storage, chat);
  if (personaSnapshot) extra.personaSnapshot = personaSnapshot;
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

function discordWebhookUrl(chat: JsonRecord): string {
  return readString(parseRecord(chat.metadata).discordWebhookUrl).trim();
}

function limitedDiscordName(value: string | null | undefined, fallback: string): string {
  const trimmed = readString(value).trim() || fallback;
  return [...trimmed].slice(0, 80).join("");
}

async function characterNameById(
  storage: StorageGateway,
  characters: GenerationCharacterContext[],
  characterId: string,
): Promise<string | null> {
  const known = characters.find((character) => character.id === characterId);
  if (known?.name) return known.name;
  const row = await storage.get<JsonRecord>("characters", characterId).catch(() => null);
  if (!isRecord(row)) return null;
  return readString(parseRecord(row.data).name).trim() || readString(row.name).trim() || null;
}

async function assistantDiscordName(args: {
  storage: StorageGateway;
  chat: JsonRecord;
  saved: unknown;
  characters: GenerationCharacterContext[];
}): Promise<string> {
  const mode = readString(args.chat.mode || args.chat.chatMode).trim();
  const metadata = parseRecord(args.chat.metadata);
  if (mode === "game") {
    const gmCharacterId = readString(metadata.gameGmCharacterId).trim();
    if (readString(metadata.gameGmMode).trim() === "character" && gmCharacterId) {
      return limitedDiscordName(await characterNameById(args.storage, args.characters, gmCharacterId), "Narrator");
    }
    return "Narrator";
  }

  const characterId = isRecord(args.saved) ? readString(args.saved.characterId).trim() : "";
  if (characterId) {
    return limitedDiscordName(await characterNameById(args.storage, args.characters, characterId), "Character");
  }
  return limitedDiscordName(args.characters.length === 1 ? args.characters[0]?.name : null, "Assistant");
}

function mirrorDiscordMessage(args: {
  integrations: IntegrationGateway;
  chat: JsonRecord;
  content: string;
  username: string;
  avatarUrl?: string | null;
}): void {
  const webhookUrl = discordWebhookUrl(args.chat);
  const content = args.content.trim();
  if (!webhookUrl || !content) return;
  if (!args.integrations.discord) {
    console.warn("[generation] Discord mirror skipped: integration gateway unavailable");
    return;
  }
  const payload: {
    webhookUrl: string;
    content: string;
    username: string;
    avatarUrl?: string;
  } = {
    webhookUrl,
    content,
    username: limitedDiscordName(args.username, "Marinara"),
  };
  if (args.avatarUrl) payload.avatarUrl = args.avatarUrl;
  void args.integrations.discord.mirrorMessage(payload).catch((error) => {
    console.warn("[generation] Discord mirror failed", error);
  });
}

function mirrorSavedUserMessageToDiscord(args: {
  deps: GenerationEngineDeps;
  chat: JsonRecord;
  input: StartGenerationInput;
  prepared: PreparedUserInput;
  persona: GenerationPersonaContext | null;
}): void {
  if (!shouldSaveUserMessage(args.input, args.prepared)) return;
  mirrorDiscordMessage({
    integrations: args.deps.integrations,
    chat: args.chat,
    content: args.prepared.content || inputUserMessage(args.input),
    username: limitedDiscordName(args.persona?.name, "User"),
  });
}

function savedUserPersonaContext(saved: unknown): GenerationPersonaContext | null {
  if (!isRecord(saved)) return null;
  const snapshot = parseRecord(parseRecord(saved.extra).personaSnapshot);
  const name = readString(snapshot.name).trim();
  if (!name) return null;
  return {
    name,
    description: readString(snapshot.description),
    personality: readString(snapshot.personality),
    backstory: readString(snapshot.backstory),
    appearance: readString(snapshot.appearance),
    scenario: readString(snapshot.scenario),
    tags: [],
  };
}

function imageExtension(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0]?.toLowerCase() || "png";
  if (subtype === "jpeg") return "jpg";
  if (/^[a-z0-9]+$/.test(subtype)) return subtype;
  return "png";
}

function illustrationSize(value: unknown): { width: number; height: number } {
  const text = readString(value).trim();
  const match = text.match(/^(\d{2,5})\s*x\s*(\d{2,5})$/i);
  const width = match ? readNumber(match[1], 1024) : 1024;
  const height = match ? readNumber(match[2], 768) : 768;
  return {
    width: Math.max(256, Math.min(2048, Math.trunc(width))),
    height: Math.max(256, Math.min(2048, Math.trunc(height))),
  };
}

type IllustrationPromptData = {
  agentId: string;
  prompt: string;
  reason: string;
  negativePrompt: string;
  characterNames: string[];
};

type IllustrationImageSettings = {
  connectionId: string;
  positivePrompt: string;
  negativePrompt: string;
  useAvatarReferences: boolean;
};

type IllustrationReferenceSubject = {
  id: string;
  name: string;
  avatar: string;
  spriteOwnerType: SpriteOwnerType;
};

type IllustrationReferenceData = {
  referenceImages: string[];
  referenceSubjectNames: string[];
};

function promptContainsTag(prompt: string, tag: string): boolean {
  const normalizedPrompt = prompt.toLowerCase();
  const normalizedTag = tag.toLowerCase();
  if (!normalizedTag) return true;
  if (normalizedPrompt.includes(normalizedTag)) return true;
  const compactTag = normalizedTag.replace(/\s+/g, " ");
  const compactPrompt = normalizedPrompt.replace(/[{}()[\]"']/g, " ").replace(/\s+/g, " ");
  return compactPrompt.includes(compactTag);
}

function appendMissingPositiveTags(prompt: string, positive: string): string {
  const basePrompt = prompt.trim();
  const tags = positive
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (!basePrompt || tags.length === 0) return basePrompt;

  const missing = tags.filter((tag) => !promptContainsTag(basePrompt, tag));
  return missing.length > 0 ? `${basePrompt}, ${missing.join(", ")}` : basePrompt;
}

function combinedPromptParts(parts: string[]): string {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const text = part.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result.join(", ");
}

function usableReferenceImage(value: unknown): string {
  const text = readString(value).trim();
  if (!text) return "";
  if (text.startsWith("data:image/")) return text;
  if (/^[A-Za-z0-9+/=\s]+$/.test(text) && text.replace(/\s+/g, "").length > 80) return text;
  return "";
}

function recordName(record: JsonRecord): string {
  const data = parseRecord(record.data);
  return readString(data.name).trim() || readString(record.name).trim();
}

function recordAvatar(record: JsonRecord): string {
  const data = parseRecord(record.data);
  return usableReferenceImage(
    record.avatarPath ?? record.avatar ?? record.avatarUrl ?? data.avatarPath ?? data.avatar ?? data.avatarUrl,
  );
}

function matchesIllustrationSubject(subject: IllustrationReferenceSubject, item: IllustrationPromptData): boolean {
  const name = subject.name.trim().toLowerCase();
  if (!name) return false;
  const requestedNames = item.characterNames.map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  if (requestedNames.length > 0) {
    return requestedNames.some(
      (requested) => requested === name || requested.includes(name) || name.includes(requested),
    );
  }
  const prompt = item.prompt.toLowerCase();
  if (prompt.includes(name)) return true;
  return name
    .split(/\s+/)
    .filter((part) => part.length > 2)
    .some((part) => prompt.includes(part));
}

function fullBodySpriteReference(sprites: Array<Record<string, unknown>>): string {
  const fullBody = sprites.filter((sprite) => readString(sprite.expression).trim().toLowerCase().startsWith("full_"));
  const preferred =
    fullBody.find((sprite) =>
      ["full_idle", "full_neutral", "full_default"].includes(readString(sprite.expression).trim().toLowerCase()),
    ) ?? fullBody[0];
  return usableReferenceImage(preferred?.url ?? preferred?.image ?? preferred?.base64);
}

async function defaultIllustratorImageConnectionId(storage: StorageGateway): Promise<string> {
  const connections = await storage.list<JsonRecord>("connections").catch(() => []);
  const connection = connections.find(
    (item) => readString(item.provider).trim() === "image_generation" && boolish(item.defaultForAgents, false),
  );
  return readString(connection?.id).trim();
}

async function illustratorAgentSettings(storage: StorageGateway, agentId: string): Promise<JsonRecord> {
  const direct = agentId ? await storage.get<JsonRecord>("agents", agentId).catch(() => null) : null;
  if (isRecord(direct)) return parseRecord(direct.settings);
  const agents = await storage.list<JsonRecord>("agents").catch(() => []);
  const agent = agents.find(
    (item) => readString(item.id).trim() === agentId || readString(item.type).trim() === "illustrator",
  );
  return isRecord(agent) ? parseRecord(agent.settings) : {};
}

async function illustrationImageSettings(args: {
  storage: StorageGateway;
  chat: JsonRecord;
  item: IllustrationPromptData;
}): Promise<IllustrationImageSettings> {
  const meta = parseRecord(args.chat.metadata);
  const settings = await illustratorAgentSettings(args.storage, args.item.agentId);
  const connectionId =
    readString(settings.imageConnectionId).trim() ||
    readString(meta.illustrationImageConnectionId).trim() ||
    readString(meta.imageGenConnectionId).trim() ||
    (await defaultIllustratorImageConnectionId(args.storage));
  return {
    connectionId,
    positivePrompt:
      readString(settings.imagePositivePrompt).trim() || readString(meta.illustrationPositivePrompt).trim(),
    negativePrompt: combinedPromptParts([
      args.item.negativePrompt,
      readString(settings.imageNegativePrompt).trim(),
      readString(meta.illustrationNegativePrompt).trim(),
      readString(meta.selfieNegativePrompt).trim(),
    ]),
    useAvatarReferences:
      (settings.useAvatarReferences === undefined || settings.useAvatarReferences === null
        ? true
        : boolish(settings.useAvatarReferences, false)) || boolish(meta.illustrationUseAvatarReferences, false),
  };
}

async function loadIllustrationReferenceSubjects(
  storage: StorageGateway,
  chat: JsonRecord,
): Promise<IllustrationReferenceSubject[]> {
  const characterRows = await Promise.all(
    activeCharacterIds(chat).map((id) => storage.get<JsonRecord>("characters", id).catch(() => null)),
  );
  const subjects: IllustrationReferenceSubject[] = characterRows.filter(isRecord).map((row) => ({
    id: readString(row.id).trim(),
    name: recordName(row),
    avatar: recordAvatar(row),
    spriteOwnerType: "character",
  }));
  const personaId = readString(chat.personaId).trim();
  const persona = personaId ? await storage.get<JsonRecord>("personas", personaId).catch(() => null) : null;
  if (isRecord(persona)) {
    subjects.push({
      id: personaId || readString(persona.id).trim(),
      name: recordName(persona),
      avatar: recordAvatar(persona),
      spriteOwnerType: "persona",
    });
  }
  return subjects.filter((subject) => subject.id && subject.name);
}

async function illustrationReferenceData(args: {
  storage: StorageGateway;
  visuals?: VisualAssetGateway;
  chat: JsonRecord;
  item: IllustrationPromptData;
  useAvatarReferences: boolean;
}): Promise<IllustrationReferenceData> {
  const subjects = await loadIllustrationReferenceSubjects(args.storage, args.chat);
  const referenceImages: string[] = [];
  const referenceSubjectNames: string[] = [];
  const referenceSubjects = subjects.filter((subject) => matchesIllustrationSubject(subject, args.item));
  for (const subject of referenceSubjects) {
    if (!args.useAvatarReferences) continue;
    const sprites = args.visuals
      ? await args.visuals.listSprites(subject.id, subject.spriteOwnerType).catch(() => [])
      : [];
    const spriteReference = fullBodySpriteReference(sprites as Array<Record<string, unknown>>);
    const reference = spriteReference || subject.avatar;
    if (reference && !referenceImages.includes(reference)) referenceImages.push(reference);
    if (reference && !referenceSubjectNames.includes(subject.name)) referenceSubjectNames.push(subject.name);
  }
  return { referenceImages, referenceSubjectNames };
}

function promptAlreadyMentionsReferences(prompt: string): boolean {
  const text = prompt.toLowerCase();
  return (
    /\bconsult\b[\s\S]{0,80}\breference/.test(text) ||
    /\b(attached|provided|included)\s+reference/.test(text) ||
    /\breference\s+image/.test(text)
  );
}

function appendReferenceGuidance(prompt: string, subjectNames: string[]): string {
  const names = subjectNames.map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) return prompt.trim();
  if (promptAlreadyMentionsReferences(prompt)) return prompt.trim();
  const label = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return [
    prompt.trim(),
    `Reference guidance: Consult the attached reference image(s) for ${label} to preserve identity, face, hair, body proportions, and distinctive visible features. Follow the scene prompt for the current outfit, pose, expression, injuries, lighting, and other moment-specific details; scene-specific appearance overrides default reference clothing.`,
  ].join("\n\n");
}

function illustratorPromptData(result: AgentResult): IllustrationPromptData | null {
  if (result.agentType !== "illustrator" && result.type !== "image_prompt") return null;
  if (!result.success) return null;
  const data = parseRecord(result.data);
  if (data.shouldGenerate !== true) return null;
  const prompt = readString(data.prompt ?? data.imagePrompt ?? data.positivePrompt).trim();
  if (!prompt) return null;
  return {
    agentId: result.agentId,
    prompt,
    reason: readString(data.reason).trim(),
    negativePrompt: readString(data.negativePrompt ?? data.negative_prompt).trim(),
    characterNames: stringArray(data.characters ?? data.characterNames ?? data.visibleCharacters),
  };
}

async function generateIllustrationAttachments(args: {
  deps: GenerationEngineDeps;
  chat: JsonRecord;
  results: AgentResult[];
  signal?: AbortSignal;
}): Promise<{ attachments: JsonRecord[]; events: GenerationEvent[] }> {
  const attachments: JsonRecord[] = [];
  const events: GenerationEvent[] = [];
  const meta = parseRecord(args.chat.metadata);
  const prompts = args.results.map(illustratorPromptData).filter((value): value is IllustrationPromptData => !!value);
  if (prompts.length === 0) return { attachments, events };

  if (!args.deps.integrations?.image) {
    events.push({ type: "illustration_error", data: { error: "Image generation is not available." } });
    return { attachments, events };
  }

  const size = illustrationSize(meta.illustrationResolution ?? meta.selfieResolution);
  for (let index = 0; index < prompts.length; index += 1) {
    throwIfAborted(args.signal);
    const item = prompts[index]!;
    try {
      const settings = await illustrationImageSettings({ storage: args.deps.storage, chat: args.chat, item });
      if (!settings.connectionId) {
        events.push({
          type: "illustration_error",
          data: { error: "No image generation connection configured for the Illustrator agent." },
        });
        continue;
      }
      const referenceData = await illustrationReferenceData({
        storage: args.deps.storage,
        visuals: args.deps.visuals,
        chat: args.chat,
        item,
        useAvatarReferences: settings.useAvatarReferences,
      });
      const prompt = appendReferenceGuidance(
        appendMissingPositiveTags(item.prompt, settings.positivePrompt),
        referenceData.referenceSubjectNames,
      );
      const image = await args.deps.integrations.image.generate<{
        base64?: string;
        mimeType?: string;
        image?: string;
        provider?: string;
        model?: string;
      }>({
        connectionId: settings.connectionId,
        kind: "illustration",
        reviewId: `illustration:${readString(args.chat.id)}:${index}`,
        reviewTitle: "Scene illustration",
        prompt,
        negativePrompt: settings.negativePrompt || undefined,
        width: size.width,
        height: size.height,
        ...(referenceData.referenceImages.length > 0 ? { referenceImages: referenceData.referenceImages } : {}),
      });
      throwIfAborted(args.signal);
      const mimeType = image.mimeType || "image/png";
      const base64 = readString(image.base64).trim();
      const imageUrl = readString(image.image).trim() || (base64 ? `data:${mimeType};base64,${base64}` : "");
      if (!imageUrl) throw new Error("Image provider returned no image data.");

      const filename = `illustration_${Date.now()}_${index + 1}.${imageExtension(mimeType)}`;
      const gallery = await args.deps.storage.create<JsonRecord>("gallery", {
        chatId: readString(args.chat.id),
        filePath: filename,
        filename,
        url: imageUrl,
        prompt,
        provider: image.provider ?? "image_generation",
        model: image.model ?? null,
        width: size.width,
        height: size.height,
        kind: "illustration",
        characters:
          referenceData.referenceSubjectNames.length > 0 ? referenceData.referenceSubjectNames : item.characterNames,
        referenceImageCount: referenceData.referenceImages.length,
      });
      const attachment = {
        type: "image",
        url: imageUrl,
        filename,
        prompt,
        galleryId: readString(gallery.id) || null,
      };
      attachments.push(attachment);
      events.push({
        type: "illustration",
        data: {
          imageUrl,
          prompt,
          reason: item.reason,
          galleryId: readString(gallery.id) || null,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      events.push({
        type: "illustration_error",
        data: { error: error instanceof Error ? error.message : "Illustration generation failed." },
      });
    }
  }

  return { attachments, events };
}

async function mirrorSavedAssistantMessageToDiscord(args: {
  deps: GenerationEngineDeps;
  chat: JsonRecord;
  input: StartGenerationInput;
  saved: unknown;
  content: string;
  characters: GenerationCharacterContext[];
}): Promise<void> {
  if (args.input.impersonate === true || readString(args.input.regenerateMessageId).trim()) return;
  const username = await assistantDiscordName({
    storage: args.deps.storage,
    chat: args.chat,
    saved: args.saved,
    characters: args.characters,
  });
  mirrorDiscordMessage({
    integrations: args.deps.integrations,
    chat: args.chat,
    content: args.content,
    username,
  });
}

async function inputWithStoredGenerationReplay(
  storage: StorageGateway,
  chat: JsonRecord,
  chatId: string,
  input: StartGenerationInput,
): Promise<StartGenerationInput> {
  const regenerateMessageId = readString(input.regenerateMessageId).trim();
  if (!regenerateMessageId) return input;

  const target = await storage.get("messages", regenerateMessageId).catch(() => null);
  if (!isRecord(target) || readString(target.chatId).trim() !== chatId) return input;

  const targetExtra = parseRecord(target.extra);
  const replay = normalizeGenerationReplay(targetExtra.generationReplay);
  if (!replay) return input;
  const currentFingerprint = fingerprintChatSummary(chatSummaryForGeneration(chat));
  if (!chatSummaryFingerprintMatches(targetExtra, currentFingerprint)) return input;

  const nextInput = { ...input };
  applyGenerationReplayToRegenerateInput(nextInput, replay);
  return nextInput;
}

function requestMessages(input: StartGenerationInput): LlmMessage[] | null {
  if (!Array.isArray(input.messages) || input.messages.length === 0) return null;
  return input.messages
    .map(
      (message): LlmMessage => ({
        role: message.role === "system" || message.role === "assistant" ? message.role : "user",
        content: readString(message.content).trim(),
      }),
    )
    .filter((message) => message.content.length > 0);
}

function generationMessageLoadOptions(
  chat: JsonRecord,
  input: StartGenerationInput,
): Parameters<StorageGateway["listChatMessages"]>[1] {
  const chatLimit = readNumber(parseRecord(chat.metadata).contextMessageLimit, 0);
  const requestedLimit = readNumber(input.historyLimit, DEFAULT_GENERATION_HISTORY_LIMIT);
  const historyLimit = Math.max(
    1,
    Math.min(DEFAULT_GENERATION_HISTORY_LIMIT, chatLimit || requestedLimit || DEFAULT_GENERATION_HISTORY_LIMIT),
  );
  return {
    limit: Math.max(
      MIN_GENERATION_MESSAGE_LOAD_LIMIT,
      Math.min(MAX_GENERATION_MESSAGE_LOAD_LIMIT, historyLimit + GENERATION_MESSAGE_LOAD_MARGIN),
    ),
  };
}

function messageCursor(message: JsonRecord): string | null {
  const createdAt = readString(message.createdAt).trim();
  const id = readString(message.id).trim();
  return createdAt && id ? `${createdAt}|${id}` : null;
}

function targetBelongsToChat(target: JsonRecord | null, chatId: string): target is JsonRecord {
  return !!target && readString(target.chatId).trim() === chatId;
}

async function loadMessagesForGenerationTarget(args: {
  storage: StorageGateway;
  chatId: string;
  chat: JsonRecord;
  input: StartGenerationInput;
  targetMessageId?: string | null;
}): Promise<JsonRecord[]> {
  const options = generationMessageLoadOptions(args.chat, args.input);
  const targetId = readString(args.targetMessageId ?? args.input.regenerateMessageId).trim();
  if (!targetId) return loadChatMessages(args.storage, args.chatId, options);

  const target = await loadChatMessage(args.storage, targetId).catch(() => null);
  if (!targetBelongsToChat(target, args.chatId)) return loadChatMessages(args.storage, args.chatId);

  const before = messageCursor(target);
  if (!before) return loadChatMessages(args.storage, args.chatId);

  const previousMessages = await loadChatMessages(args.storage, args.chatId, { ...options, before });
  return [...previousMessages, target];
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

function impersonatePromptTemplate(input: StartGenerationInput, chat: JsonRecord): string | null {
  const requestPrompt = readString(input.impersonatePromptTemplate).trim();
  if (requestPrompt) return requestPrompt;
  const chatPrompt = readString(parseRecord(chat.metadata).impersonatePrompt).trim();
  return chatPrompt || null;
}

function directiveMessages(
  input: StartGenerationInput,
  chat: JsonRecord,
  characters: GenerationCharacterContext[],
  persona: GenerationPersonaContext | null,
  prepared: PreparedUserInput,
  options: { continueAssistantResponse?: boolean } = {},
): LlmMessage[] {
  const messages: LlmMessage[] = [];
  if (input.impersonate === true) {
    const personaName = readString(persona?.name).trim() || "User";
    messages.push({
      role: "user",
      content: buildImpersonateInstruction({
        customPrompt: impersonatePromptTemplate(input, chat),
        direction: prepared.content,
        personaName,
        personaDescription: persona?.description,
      }),
    });
    return messages;
  }

  const forCharacterId = readString(input.forCharacterId).trim();
  const chatMode = readString(chat.mode || chat.chatMode);
  if (forCharacterId && chatMode === "conversation") {
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

function messagesBeforeRegenerationTarget(
  storedMessages: JsonRecord[],
  regenerateMessageId: string | null | undefined,
): JsonRecord[] {
  const targetId = readString(regenerateMessageId).trim();
  if (!targetId) return storedMessages;
  const targetIndex = storedMessages.findIndex((message) => readString(message.id) === targetId);
  return targetIndex >= 0 ? storedMessages.slice(0, targetIndex) : storedMessages;
}

function roleplayIndividualGroupCharacterIds(chat: JsonRecord): string[] {
  if (readString(chat.mode || chat.chatMode) !== "roleplay") return [];
  const ids = activeCharacterIds(chat);
  if (ids.length <= 1) return [];
  return readString(parseRecord(chat.metadata).groupChatMode, "merged") === "individual" ? ids : [];
}

function conversationGroupCharacterIds(chat: JsonRecord): string[] {
  if (readString(chat.mode || chat.chatMode) !== "conversation") return [];
  const ids = activeCharacterIds(chat);
  return ids.length > 1 ? ids : [];
}

function targetedGroupCharacterIds(chat: JsonRecord): string[] {
  const roleplayIds = roleplayIndividualGroupCharacterIds(chat);
  return roleplayIds.length > 0 ? roleplayIds : conversationGroupCharacterIds(chat);
}

function lastVisibleAssistantCharacterId(messages: JsonRecord[], activeIds: string[]): string | null {
  const active = new Set(activeIds);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || hiddenFromAi(message)) continue;
    if (readString(message.role) !== "assistant") continue;
    const characterId = readString(message.characterId).trim();
    if (active.has(characterId)) return characterId;
  }
  return null;
}

function sequentialGroupTarget(messages: JsonRecord[], activeIds: string[]): string | null {
  if (activeIds.length === 0) return null;
  const lastCharacterId = lastVisibleAssistantCharacterId(messages, activeIds);
  if (!lastCharacterId) return activeIds[0] ?? null;
  const index = activeIds.indexOf(lastCharacterId);
  return activeIds[(index + 1) % activeIds.length] ?? activeIds[0] ?? null;
}

function activeSwipeCharacterId(message: JsonRecord | undefined): string | null {
  if (!message) return null;
  const rawSwipes = Array.isArray(message.swipes)
    ? message.swipes
    : Array.isArray(message.swipePreviews)
      ? message.swipePreviews
      : [];
  if (rawSwipes.length === 0) return null;
  const requestedIndex = Math.max(0, Math.trunc(readNumber(message.activeSwipeIndex, 0)));
  const activeIndex = Math.min(requestedIndex, rawSwipes.length - 1);
  const characterId = readString(parseRecord(rawSwipes[activeIndex]).characterId).trim();
  return characterId || null;
}

function explicitGroupTarget(
  input: StartGenerationInput,
  storedMessages: JsonRecord[],
  activeIds: string[],
): string | null {
  const active = new Set(activeIds);
  const requestedCharacterId = readString(input.forCharacterId).trim();
  if (requestedCharacterId && active.has(requestedCharacterId)) return requestedCharacterId;

  const regenerateMessageId = readString(input.regenerateMessageId).trim();
  if (!regenerateMessageId) return null;
  const target = storedMessages.find((message) => readString(message.id) === regenerateMessageId);
  const targetCharacterId = readString(activeSwipeCharacterId(target) ?? target?.characterId).trim();
  return active.has(targetCharacterId) ? targetCharacterId : null;
}

function continuationGroupTarget(args: {
  input: StartGenerationInput;
  latestUserInput: string;
  storedMessages: JsonRecord[];
  activeIds: string[];
}): string | null {
  if (readString(args.input.regenerateMessageId).trim()) return null;
  if (args.latestUserInput.trim()) return null;
  return lastVisibleAssistantCharacterId(args.storedMessages, args.activeIds);
}

type SmartResponderCandidate = {
  id: string;
  name: string;
  description: string;
  personality: string;
  talkativeness: number | null;
};

function compactPromptLine(value: unknown, limit = 260): string {
  const text = collapseExcessBlankLines(readString(value)).replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3).trimEnd()}...` : text;
}

function characterDataRecord(record: JsonRecord): JsonRecord {
  const data = parseRecord(record.data);
  return Object.keys(data).length > 0 ? data : record;
}

async function loadSmartResponderCandidates(
  storage: StorageGateway,
  activeIds: string[],
): Promise<SmartResponderCandidate[]> {
  const rows = await Promise.all(activeIds.map((id) => storage.get<JsonRecord>("characters", id).catch(() => null)));
  return rows
    .map((row, index): SmartResponderCandidate | null => {
      if (!isRecord(row)) return null;
      const data = characterDataRecord(row);
      const name = readString(data.name).trim() || readString(row.name).trim() || `Character ${index + 1}`;
      return {
        id: activeIds[index]!,
        name,
        description: compactPromptLine(data.description),
        personality: compactPromptLine(data.personality),
        talkativeness: data.talkativeness == null ? null : readNumber(data.talkativeness, 0),
      };
    })
    .filter((candidate): candidate is SmartResponderCandidate => candidate !== null);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionedSmartResponderIds(args: {
  candidates: SmartResponderCandidate[];
  latestUserInput: string;
  mentionedNames: string[];
}): string[] {
  const mentioned = new Set(args.mentionedNames.map((name) => name.trim().toLowerCase()).filter(Boolean));
  const latest = args.latestUserInput;
  const ids: string[] = [];
  for (const candidate of args.candidates) {
    const lowerName = candidate.name.toLowerCase();
    const explicitlyMentioned = mentioned.has(lowerName);
    const atMentioned = new RegExp(`(^|\\s)@${escapeRegExp(candidate.name)}(?=\\s|$|[,.!?;:])`, "i").test(latest);
    if (explicitlyMentioned || atMentioned) ids.push(candidate.id);
  }
  return ids;
}

function smartSelectorTranscript(messages: JsonRecord[]): string {
  return messages
    .filter((message) => !hiddenFromAi(message))
    .slice(-12)
    .map((message) => {
      const role = readString(message.role, "message");
      const name = readString(message.displayName || message.name || message.characterName).trim();
      const prefix = name ? `${role} (${name})` : role;
      return `${prefix}: ${compactPromptLine(message.content, 500)}`;
    })
    .join("\n");
}

function parseSmartGroupSelectionIds(raw: string, validIds: string[]): string[] {
  const valid = new Set(validIds);
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(text) as JsonRecord;
    const ids = stringArray(parsed.characterIds ?? parsed.character_ids ?? parsed.characters);
    return [...new Set(ids.filter((id) => valid.has(id)))];
  } catch {
    return validIds.filter((id) => raw.includes(id)).slice(0, 3);
  }
}

async function smartRoleplayGroupTarget(args: {
  deps: GenerationEngineDeps;
  input: StartGenerationInput;
  chat: JsonRecord;
  connection: JsonRecord;
  storedMessages: JsonRecord[];
  latestUserInput: string;
  mentionedNames: string[];
  activeIds: string[];
  signal?: AbortSignal;
}): Promise<string | null> {
  return (
    (
      await smartRoleplayGroupTargets({
        ...args,
        selectionMode: "single",
      })
    )[0] ?? null
  );
}

async function smartRoleplayGroupTargets(args: {
  deps: GenerationEngineDeps;
  input: StartGenerationInput;
  chat: JsonRecord;
  connection: JsonRecord;
  storedMessages: JsonRecord[];
  latestUserInput: string;
  mentionedNames: string[];
  activeIds: string[];
  selectionMode: "single" | "multi";
  signal?: AbortSignal;
}): Promise<string[]> {
  const candidates = await loadSmartResponderCandidates(args.deps.storage, args.activeIds);
  const mentionedIds = mentionedSmartResponderIds({
    candidates,
    latestUserInput: args.latestUserInput,
    mentionedNames: args.mentionedNames,
  });
  if (mentionedIds.length > 0) return args.selectionMode === "single" ? mentionedIds.slice(0, 1) : mentionedIds;
  const sequentialFallback = sequentialGroupTarget(args.storedMessages, args.activeIds);
  if (candidates.length === 0) return sequentialFallback ? [sequentialFallback] : [];

  const personaId = readString(args.chat.personaId).trim();
  const persona = personaId ? await args.deps.storage.get<JsonRecord>("personas", personaId).catch(() => null) : null;
  const personaData = isRecord(persona) ? characterDataRecord(persona) : {};
  const chatMode = readString(args.chat.mode || args.chat.chatMode, "conversation");
  const chatKind = chatMode === "conversation" ? "conversation group chat" : "individual-mode roleplay group chat";
  const selectionInstruction =
    args.selectionMode === "multi"
      ? "Choose the character or characters who should respond in this send. Return one or more IDs when multiple characters should take turns."
      : "Choose which character should respond next based on the latest message, direct address, conversation momentum, and talkativeness. Usually choose exactly one character.";
  const candidateLines = candidates
    .map((candidate) =>
      JSON.stringify({
        id: candidate.id,
        name: candidate.name,
        talkativeness: candidate.talkativeness,
        personality: candidate.personality,
        description: candidate.description,
      }),
    )
    .join("\n");
  let raw = "";
  try {
    raw = await args.deps.llm.complete(
      {
        connectionId: readString(args.connection.id).trim() || args.input.connectionId || null,
        provider: readString(args.connection.provider).trim() || null,
        model: readString(args.connection.model).trim() || null,
        parameters: { maxTokens: 256 },
        messages: [
          {
            role: "system",
            content: `You are a hidden response orchestrator for a ${chatKind}. ${selectionInstruction} Return only JSON: {"characterIds":["character-id"],"reason":"short"}.`,
          },
          {
            role: "user",
            content: [
              `<persona>${compactPromptLine(readString(personaData.name || persona?.name), 120)}</persona>`,
              `<candidates>\n${candidateLines}\n</candidates>`,
              `<recent_transcript>\n${smartSelectorTranscript(args.storedMessages)}\n</recent_transcript>`,
              `<latest_user_message>\n${compactPromptLine(args.latestUserInput, 1200)}\n</latest_user_message>`,
            ].join("\n\n"),
          },
        ],
      },
      args.signal,
    );
  } catch (error) {
    if (isRecord(error) && readString(error.name) === "AbortError") throw error;
  }
  const selected = parseSmartGroupSelectionIds(raw, args.activeIds);
  if (selected.length > 0) return args.selectionMode === "single" ? selected.slice(0, 1) : selected;
  return sequentialFallback ? [sequentialFallback] : [];
}

async function resolveGroupTargetForGeneration(args: {
  deps: GenerationEngineDeps;
  input: StartGenerationInput;
  chat: JsonRecord;
  connection: JsonRecord;
  storedMessages: JsonRecord[];
  latestUserInput: string;
  mentionedNames: string[];
  signal?: AbortSignal;
}): Promise<string | null> {
  if (args.input.impersonate === true) return null;
  const activeIds = targetedGroupCharacterIds(args.chat);
  if (activeIds.length === 0) return null;
  const explicit = explicitGroupTarget(args.input, args.storedMessages, activeIds);
  if (explicit) return explicit;

  const candidates = await loadSmartResponderCandidates(args.deps.storage, activeIds);
  const mentionedIds = mentionedSmartResponderIds({
    candidates,
    latestUserInput: args.latestUserInput,
    mentionedNames: args.mentionedNames,
  });
  if (mentionedIds.length > 0) return mentionedIds[0] ?? null;

  const continuation = continuationGroupTarget({
    input: args.input,
    latestUserInput: args.latestUserInput,
    storedMessages: args.storedMessages,
    activeIds,
  });
  if (continuation) return continuation;

  const order = readString(parseRecord(args.chat.metadata).groupResponseOrder, "sequential");
  if (order === "manual") return null;
  if (order === "smart") {
    return smartRoleplayGroupTarget({ ...args, activeIds });
  }
  return sequentialGroupTarget(args.storedMessages, activeIds);
}

async function resolveIndividualGroupTurnIds(args: {
  deps: GenerationEngineDeps;
  input: StartGenerationInput;
  chat: JsonRecord;
  connection: JsonRecord;
  storedMessages: JsonRecord[];
  latestUserInput: string;
  mentionedNames: string[];
  signal?: AbortSignal;
}): Promise<string[] | null> {
  if (args.input.impersonate === true || readString(args.input.regenerateMessageId).trim()) return null;
  if (Array.isArray(args.input.messages) && args.input.messages.length > 0) return null;
  if (readString(args.chat.mode || args.chat.chatMode).trim() !== "roleplay") return null;
  const metadata = parseRecord(args.chat.metadata);
  if (readString(metadata.groupChatMode, "merged") !== "individual") return null;

  const activeIds = activeCharacterIds(args.chat);
  if (activeIds.length <= 1) return null;
  const explicit = explicitGroupTarget(args.input, args.storedMessages, activeIds);
  if (explicit) return [explicit];

  const order = readString(metadata.groupResponseOrder, "sequential");
  if (order === "manual") return [];
  if (order === "smart") {
    return smartRoleplayGroupTargets({
      ...args,
      activeIds,
      selectionMode: "multi",
    });
  }
  const sequential = sequentialGroupTarget(args.storedMessages, activeIds);
  return sequential ? [sequential] : [];
}

async function* runIndividualGroupTurnLoop(args: {
  deps: GenerationEngineDeps;
  input: StartGenerationInput;
  turnIds: string[];
  latestUserInput: string;
  signal?: AbortSignal;
}): AsyncGenerator<GenerationEvent> {
  for (let index = 0; index < args.turnIds.length; index += 1) {
    throwIfAborted(args.signal);
    const characterId = args.turnIds[index]!;
    const characterName = (await characterNameById(args.deps.storage, [], characterId)) ?? "Character";
    yield { type: "group_turn", data: { characterId, characterName, index, total: args.turnIds.length } };

    const childInput: StartGenerationInput = {
      ...args.input,
      userMessage: null,
      message: "",
      attachments: [],
      forCharacterId: characterId,
    };
    internalStartGenerationOptions.set(childInput, {
      groupTurnChild: true,
      latestUserInput: args.latestUserInput,
      skipUserMessageSave: true,
    });

    for await (const event of startGeneration(args.deps, childInput, args.signal)) {
      if (event.type === "user_message" || event.type === "done") continue;
      if (event.type === "agent_injection_review") {
        yield event;
        yield { type: "done" };
        return;
      }
      yield event;
    }
  }
  yield { type: "done" };
}

type ConversationAvailabilityStatus = "online" | "idle" | "dnd" | "offline";

type ConversationAvailabilityCharacter = {
  id: string;
  name: string;
  status: ConversationAvailabilityStatus;
  schedule?: WeekSchedule | null;
};

function conversationStatus(value: unknown): ConversationAvailabilityStatus {
  return value === "idle" || value === "dnd" || value === "offline" ? value : "online";
}

async function resolveConversationAvailability(args: {
  storage: StorageGateway;
  chat: JsonRecord;
  targetCharacterId?: string | null;
}): Promise<{
  characters: ConversationAvailabilityCharacter[];
  allOffline: boolean;
  delayMs: number;
  delayStatus: ConversationAvailabilityStatus;
} | null> {
  if (readString(args.chat.mode || args.chat.chatMode).trim() !== "conversation") return null;
  const activeIds = activeCharacterIds(args.chat);
  if (activeIds.length === 0) return null;
  const activeSet = new Set(activeIds);
  const requested = readString(args.targetCharacterId).trim();
  const respondingIds = requested && activeSet.has(requested) ? [requested] : activeIds;
  const statusResult = await getConversationStatus(args.storage, readString(args.chat.id).trim());
  const characters: ConversationAvailabilityCharacter[] = [];
  for (const id of respondingIds) {
    const row = statusResult.statuses[id];
    characters.push({
      id,
      name: (await characterNameById(args.storage, [], id)) ?? "Character",
      status: conversationStatus(row?.status),
      schedule: isRecord(row?.schedule) ? (row.schedule as unknown as WeekSchedule) : null,
    });
  }
  const allOffline = characters.length > 0 && characters.every((character) => character.status === "offline");
  let delayMs = 0;
  let delayStatus: ConversationAvailabilityStatus = "online";
  for (const character of characters) {
    const characterDelay = getBusyDelay(character.status, character.schedule ?? undefined);
    if (characterDelay > delayMs) {
      delayMs = characterDelay;
      delayStatus = character.status;
    }
  }
  return { characters, allOffline, delayMs, delayStatus };
}

function abortableDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(abortGenerationError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortGenerationError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function sequentialGroupTargetCharacterId(
  chat: JsonRecord,
  input: StartGenerationInput,
  messages: JsonRecord[],
): string | null {
  if (input.impersonate === true) return null;
  if (readString(input.forCharacterId).trim()) return null;
  const metadata = parseRecord(chat.metadata);
  if (readString(chat.mode || chat.chatMode).trim() !== "roleplay") return null;
  if (readString(metadata.groupChatMode, "merged") !== "individual") return null;
  if (readString(metadata.groupResponseOrder, "smart") !== "sequential") return null;
  const activeIds = activeCharacterIds(chat);
  if (activeIds.length <= 1) return null;

  const regenerateMessageId = readString(input.regenerateMessageId).trim();
  if (regenerateMessageId) return explicitGroupTarget(input, messages, activeIds);

  return sequentialGroupTarget(messages, activeIds);
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
  if (readString(input.forCharacterId).trim()) return false;
  if (!isPassiveGenerationRequest(input, prepared)) return false;
  return readString(latestVisibleMessage(storedMessages)?.role) === "assistant";
}

function resultKey(result: AgentResult): string {
  return `${result.agentId}:${result.agentType}:${result.type}:${JSON.stringify(result.data)}`;
}

function uniqueAgentResults(results: AgentResult[]): AgentResult[] {
  const unique = new Map<string, AgentResult>();
  for (const result of results) {
    unique.set(resultKey(result), result);
  }
  return [...unique.values()];
}

async function agentNameLookup(storage: StorageGateway): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  for (const agent of await storage.list<JsonRecord>("agents").catch(() => [])) {
    const name = readString(agent.name).trim();
    if (!name) continue;
    const id = readString(agent.id).trim();
    const type = readString(agent.type || agent.agentType).trim();
    if (id) lookup.set(id, name);
    if (type) lookup.set(type, name);
  }
  return lookup;
}

async function persistAgentResults(
  storage: StorageGateway,
  chatId: string,
  messageId: string | null,
  results: AgentResult[],
): Promise<void> {
  const seen = new Set<string>();
  const agentNames = await agentNameLookup(storage);
  for (const result of results) {
    const key = resultKey(result);
    if (seen.has(key)) continue;
    seen.add(key);
    await storage.create("agent-runs", {
      chatId,
      messageId,
      agentConfigId: result.agentId,
      agentId: result.agentId,
      agentType: result.agentType,
      agentName: agentNames.get(result.agentId) ?? agentNames.get(result.agentType) ?? result.agentType,
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

async function persistSecretPlotAgentMemorySafely(
  storage: StorageGateway,
  chatId: string,
  results: AgentResult[],
): Promise<void> {
  try {
    await persistSecretPlotAgentMemory(storage, chatId, results);
  } catch (error) {
    console.warn("[generation] secret plot memory persist failed", error);
  }
}

async function persistTrackerSnapshotSafely(
  storage: StorageGateway,
  chatId: string,
  targetMessage: unknown,
  results: AgentResult[],
  baseSnapshot?: GameState | null,
  sourceText?: string | null,
): Promise<void> {
  const target = trackerSnapshotTargetFromMessage(targetMessage);
  if (!target) return;
  try {
    await persistTrackerSnapshotForTurn(storage, chatId, target, results, { baseSnapshot, sourceText });
  } catch (error) {
    console.warn("[generation] tracker snapshot persist failed", error);
  }
}

/**
 * Snapshots are retained for only the most recent assistant messages to bound
 * per-chat storage growth (parity with v1.6.1). Older assistant messages keep
 * their text but drop the saved prompt; the inspector then shows "No saved
 * prompt snapshot" for them, exactly as v1.6.1 did.
 */
const PROMPT_SNAPSHOT_KEEP_LAST = 2;

async function evictStalePromptSnapshotsSafely(storage: StorageGateway, chatId: string): Promise<void> {
  try {
    await storage.evictPromptSnapshots?.(chatId, PROMPT_SNAPSHOT_KEEP_LAST);
  } catch (error) {
    console.warn("[generation] prompt snapshot eviction failed", error);
  }
}

function shouldRefreshMemoryRecall(chat: JsonRecord): boolean {
  const meta = parseRecord(chat.metadata);
  if (typeof meta.enableMemoryRecall === "boolean") return meta.enableMemoryRecall;
  const mode = readString(chat.mode || chat.chatMode);
  return mode === "conversation" || meta.sceneStatus === "active";
}

async function refreshMemoryRecallSafely(storage: StorageGateway, chat: JsonRecord): Promise<void> {
  if (!storage.refreshChatMemories || !shouldRefreshMemoryRecall(chat)) return;
  const chatId = readString(chat.id).trim();
  if (!chatId) return;
  try {
    await storage.refreshChatMemories(chatId);
  } catch (error) {
    console.warn("[generation] memory recall refresh failed", error);
  }
}

async function persistLorebookTimingStatesSafely(
  storage: StorageGateway,
  chatId: string,
  timingStates: Record<string, unknown> | null,
  entryStateOverrides?: Record<string, unknown> | null,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (timingStates) patch.entryTimingStates = timingStates;
  if (entryStateOverrides) patch.entryStateOverrides = entryStateOverrides;
  if (Object.keys(patch).length === 0) return;
  try {
    await storage.patchChatMetadata(chatId, patch);
  } catch (error) {
    console.warn("[generation] lorebook runtime state persist failed", error);
  }
}

function cloneSerializableValue<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function clonePromptMessage(message: LlmMessage): GenerationPromptSnapshotMessage {
  const snapshot = cloneSerializableValue(message) as GenerationPromptSnapshotMessage;
  snapshot.role = message.role;
  snapshot.content = readString(message.content);
  if (message.name) snapshot.name = message.name;
  if (message.images?.length) snapshot.images = [...message.images];
  if (message.tool_call_id) snapshot.tool_call_id = message.tool_call_id;
  if (message.tool_calls != null) snapshot.tool_calls = cloneSerializableValue(message.tool_calls);
  return snapshot;
}

function nullableNumber(value: unknown): number | null {
  const parsed = readNumber(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function usageNumber(usage: unknown, keys: string[]): number | null {
  const record = parseRecord(usage);
  for (const key of keys) {
    const parsed = nullableNumber(record[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function buildSavedGenerationPromptSnapshot(args: {
  connection: JsonRecord;
  promptSnapshot?: MainGenerationPromptSnapshot | null;
  usage?: unknown;
}): GenerationPromptSnapshot | null {
  if (!args.promptSnapshot?.messages?.length) return null;
  const parameters = cloneSerializableValue(args.promptSnapshot.parameters ?? {});
  const tools = Array.isArray(args.promptSnapshot.tools) ? cloneSerializableValue(args.promptSnapshot.tools) : null;
  const generationInfo = generationInfoFromVisibleParameters(args.connection, isRecord(parameters) ? parameters : {});
  return {
    messages: args.promptSnapshot.messages.map(clonePromptMessage),
    parameters: isRecord(parameters) ? parameters : {},
    ...(tools?.length ? { tools } : {}),
    promptPresetId: args.promptSnapshot.promptPresetId ?? null,
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
      tokensPrompt: usageNumber(args.usage, ["promptTokens", "prompt_tokens", "inputTokens", "input_tokens"]),
      tokensCompletion: usageNumber(args.usage, [
        "completionTokens",
        "completion_tokens",
        "outputTokens",
        "output_tokens",
      ]),
      tokensCachedPrompt: usageNumber(args.usage, [
        "cachedPromptTokens",
        "cached_prompt_tokens",
        "cacheReadInputTokens",
        "cache_read_input_tokens",
      ]),
      tokensCacheWritePrompt: usageNumber(args.usage, [
        "cacheWritePromptTokens",
        "cache_write_prompt_tokens",
        "cacheCreationInputTokens",
        "cache_creation_input_tokens",
      ]),
      durationMs: usageNumber(args.usage, ["durationMs", "duration_ms"]),
      finishReason: readString(parseRecord(args.usage).finishReason ?? parseRecord(args.usage).finish_reason) || null,
    },
    createdAt: nowIso(),
  };
}

function spriteExpressionsFromAgentResults(
  results: AgentResult[],
  availableSprites: AvailableSpriteCharacter[] | undefined,
): Record<string, string> | null {
  const entries: SpriteExpressionEntry[] = [];
  const hasAvailableSprites = Array.isArray(availableSprites) && availableSprites.length > 0;
  const expressions: Record<string, string> = {};
  for (const result of results) {
    if (!result.success || result.agentType !== "expression") continue;
    const data = parseRecord(result.data);
    const rawEntries = Array.isArray(data.expressions) ? data.expressions : [];
    for (const entry of rawEntries) {
      const record = parseRecord(entry);
      entries.push({
        characterId: record.characterId,
        characterName: record.characterName,
        expression: record.expression,
        transition: record.transition,
      });
    }
  }

  if (entries.length === 0 || !hasAvailableSprites) return null;

  const validation = validateSpriteExpressionEntries(entries, availableSprites);
  for (const entry of validation.expressions) {
    const expression = readString(entry.expression).trim();
    const characterId = readString(entry.characterId).trim();
    if (characterId && expression) expressions[characterId] = expression;
  }
  return Object.keys(expressions).length > 0 ? expressions : null;
}

function assertVisibleGeneratedContent(content: string, attachments?: JsonRecord[]): void {
  if (content.trim() || (attachments?.length ?? 0) > 0) return;
  throw new Error(
    "Generation produced no visible assistant response. Your message was kept; retry or adjust the provider.",
  );
}

function normalizeCyoaChoices(value: unknown): CyoaChoice[] {
  const data = parseRecord(value);
  const rawChoices = Array.isArray(data.choices) ? data.choices : Array.isArray(value) ? value : [];
  return rawChoices
    .map((choice, index) => {
      const record = parseRecord(choice);
      const text = readString(record.text).trim();
      if (!text) return null;
      const label = readString(record.label).trim() || `Choice ${index + 1}`;
      return { label, text };
    })
    .filter((choice): choice is CyoaChoice => choice !== null);
}

function cyoaChoicesFromAgentResults(results: AgentResult[]): CyoaChoice[] | null {
  let choices: CyoaChoice[] | null = null;
  for (const result of results) {
    if (!result.success) continue;
    if (result.agentType !== "cyoa" && result.type !== "cyoa_choices") continue;
    const nextChoices = normalizeCyoaChoices(result.data);
    if (nextChoices.length > 0) choices = nextChoices;
  }
  return choices;
}

function normalizeContextInjections(value: unknown): AgentInjectionOverride[] {
  if (!Array.isArray(value)) return [];
  const injections: AgentInjectionOverride[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const agentType = readString(entry.agentType).trim();
    const text = readString(entry.text).trim();
    if (!agentType || !text) continue;
    const agentName = readString(entry.agentName).trim();
    injections.push({ agentType, ...(agentName ? { agentName } : {}), text });
  }
  return injections;
}

function mergeContextInjections(
  existing: unknown,
  updates: readonly AgentInjectionOverride[],
): AgentInjectionOverride[] {
  const merged = normalizeContextInjections(existing);
  const indexByAgentType = new Map(merged.map((injection, index) => [injection.agentType, index]));
  for (const update of updates) {
    const index = indexByAgentType.get(update.agentType);
    if (index == null) {
      indexByAgentType.set(update.agentType, merged.length);
      merged.push({ ...update });
    } else {
      merged[index] = { ...update };
    }
  }
  return merged;
}

function agentExtraFromResults(args: {
  results: AgentResult[];
  contextInjections?: AgentInjectionOverride[] | null;
  existingExtra?: unknown;
  mergeContextInjectionUpdates?: boolean;
}): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  const cyoaChoices = cyoaChoicesFromAgentResults(args.results);
  if (cyoaChoices?.length) extra.cyoaChoices = cyoaChoices;

  const contextInjections = normalizeContextInjections(args.contextInjections);
  if (contextInjections.length > 0) {
    extra.contextInjections = args.mergeContextInjectionUpdates
      ? mergeContextInjections(parseRecord(args.existingExtra).contextInjections, contextInjections)
      : contextInjections;
  }

  return extra;
}

function assistantMessageCharacterId(chat: JsonRecord, input: StartGenerationInput): string | null {
  const requestedCharacterId = readString(input.forCharacterId).trim();
  const chatCharacterIdList = activeCharacterIds(chat);
  const chatCharacterIds = new Set(chatCharacterIdList);
  return requestedCharacterId && (chatCharacterIds.size === 0 || chatCharacterIds.has(requestedCharacterId))
    ? requestedCharacterId
    : chatCharacterIdList.length === 1
      ? chatCharacterIdList[0]!
      : null;
}

async function saveAssistantMessage(args: {
  storage: StorageGateway;
  chat: JsonRecord;
  input: StartGenerationInput;
  connection: JsonRecord;
  content: string;
  thinking?: string | null;
  agentResults: AgentResult[];
  noteCount: number;
  chatSummaryFingerprint: string | null;
  attachments?: JsonRecord[];
  usage?: unknown;
  promptSnapshot?: MainGenerationPromptSnapshot | null;
  spriteExpressions?: Record<string, string> | null;
  contextInjections?: AgentInjectionOverride[] | null;
}): Promise<unknown | null> {
  const regenerateMessageId = readString(args.input.regenerateMessageId).trim();
  const generationReplay = buildGenerationReplay(args.input);
  const content = collapseExcessBlankLines(args.content);
  assertVisibleGeneratedContent(content, args.attachments);
  const thinking = collapseExcessBlankLines(readString(args.thinking).trim());
  const promptSnapshot = buildSavedGenerationPromptSnapshot({
    connection: args.connection,
    promptSnapshot: args.promptSnapshot,
    usage: args.usage,
  });
  const agentExtra = agentExtraFromResults({
    results: args.agentResults,
    contextInjections: args.contextInjections,
  });

  if (args.input.impersonate === true) {
    if (regenerateMessageId) {
      return saveRegeneratedMessage({
        storage: args.storage,
        chatId: args.input.chatId,
        messageId: regenerateMessageId,
        content,
        characterId: null,
        thinking: thinking || undefined,
        generationReplay,
        chatSummaryFingerprint: args.chatSummaryFingerprint,
        promptSnapshot,
        spriteExpressions: args.spriteExpressions,
        agentExtra,
      });
    }

    return args.storage.createChatMessage(args.input.chatId, {
      role: "user",
      characterId: null,
      content,
      extra: {
        isGenerated: true,
        ...(thinking ? { thinking } : {}),
        ...(generationReplay ? { generationReplay } : {}),
        ...(args.spriteExpressions ? { spriteExpressions: args.spriteExpressions } : {}),
        ...agentExtra,
        ...(promptSnapshot
          ? {
              generationPromptSnapshot: promptSnapshot,
            }
          : {}),
        chatSummaryFingerprint: args.chatSummaryFingerprint,
      },
    });
  }

  if (regenerateMessageId) {
    const characterId = assistantMessageCharacterId(args.chat, args.input);
    return saveRegeneratedMessage({
      storage: args.storage,
      chatId: args.input.chatId,
      messageId: regenerateMessageId,
      content,
      ...(characterId ? { characterId } : {}),
      thinking: thinking || undefined,
      generationReplay,
      chatSummaryFingerprint: args.chatSummaryFingerprint,
      promptSnapshot,
      spriteExpressions: args.spriteExpressions,
      agentExtra,
    });
  }

  const characterId = assistantMessageCharacterId(args.chat, args.input);

  return args.storage.createChatMessage(args.input.chatId, {
    role: "assistant",
    characterId,
    content,
    extra: {
      ...(args.attachments?.length ? { attachments: args.attachments } : {}),
      ...(thinking ? { thinking } : {}),
      ...(generationReplay ? { generationReplay } : {}),
      ...(args.spriteExpressions ? { spriteExpressions: args.spriteExpressions } : {}),
      ...agentExtra,
      ...(promptSnapshot
        ? {
            generationPromptSnapshot: promptSnapshot,
          }
        : {}),
      chatSummaryFingerprint: args.chatSummaryFingerprint,
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

async function saveRegeneratedMessage(args: {
  storage: StorageGateway;
  chatId: string;
  messageId: string;
  content: string;
  characterId?: string | null;
  thinking?: string | null;
  generationReplay: GenerationReplay | null;
  chatSummaryFingerprint: string | null;
  promptSnapshot: GenerationPromptSnapshot | null;
  spriteExpressions?: Record<string, string> | null;
  agentExtra?: Record<string, unknown> | null;
}): Promise<unknown | null> {
  const swipeExtra = swipeScopedGenerationExtra({
    generationReplay: args.generationReplay,
    chatSummaryFingerprint: args.chatSummaryFingerprint,
    thinking: args.thinking,
    promptSnapshot: args.promptSnapshot,
    spriteExpressions: args.spriteExpressions,
    agentExtra: args.agentExtra,
  });
  await args.storage.addChatMessageSwipe(
    args.chatId,
    args.messageId,
    collapseExcessBlankLines(args.content),
    swipeOptionsWithCharacterId(swipeExtra, args),
  );
  const extraPatch = generationReplayExtraPatch({
    generationReplay: args.generationReplay,
    chatSummaryFingerprint: args.chatSummaryFingerprint,
    thinking: args.thinking,
    promptSnapshot: args.promptSnapshot,
    spriteExpressions: args.spriteExpressions,
    agentExtra: args.agentExtra,
  });
  return args.storage.patchChatMessageExtra(args.messageId, extraPatch);
}

function swipeOptionsWithCharacterId(
  extra: Record<string, unknown>,
  args: { characterId?: string | null },
): AddChatMessageSwipeOptions {
  const options: AddChatMessageSwipeOptions = { extra };
  if (Object.prototype.hasOwnProperty.call(args, "characterId")) {
    options.characterId = args.characterId ?? null;
  }
  return options;
}

function swipeScopedGenerationExtra(args: {
  generationReplay: GenerationReplay | null;
  chatSummaryFingerprint: string | null;
  thinking?: string | null;
  promptSnapshot?: GenerationPromptSnapshot | null;
  spriteExpressions?: Record<string, string> | null;
  agentExtra?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  if (args.generationReplay) extra.generationReplay = args.generationReplay;
  extra.chatSummaryFingerprint = args.chatSummaryFingerprint;
  const trimmedThinking = collapseExcessBlankLines(readString(args.thinking).trim());
  if (trimmedThinking) extra.thinking = trimmedThinking;
  if (args.spriteExpressions && Object.keys(args.spriteExpressions).length > 0) {
    extra.spriteExpressions = args.spriteExpressions;
  }
  if (args.agentExtra) Object.assign(extra, args.agentExtra);
  if (args.promptSnapshot) extra.generationPromptSnapshot = args.promptSnapshot;
  return extra;
}

function generationReplayExtraPatch(args: {
  generationReplay: GenerationReplay | null;
  chatSummaryFingerprint: string | null;
  thinking?: string | null;
  promptSnapshot?: GenerationPromptSnapshot | null;
  spriteExpressions?: Record<string, string> | null;
  agentExtra?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const extraPatch: Record<string, unknown> = {};
  if (args.generationReplay) extraPatch.generationReplay = args.generationReplay;
  extraPatch.chatSummaryFingerprint = args.chatSummaryFingerprint;
  const trimmedThinking = collapseExcessBlankLines(readString(args.thinking).trim());
  if (trimmedThinking) extraPatch.thinking = trimmedThinking;
  if (args.spriteExpressions && Object.keys(args.spriteExpressions).length > 0) {
    extraPatch.spriteExpressions = args.spriteExpressions;
  }
  if (args.agentExtra) Object.assign(extraPatch, args.agentExtra);
  if (args.promptSnapshot) {
    extraPatch.generationPromptSnapshot = args.promptSnapshot;
  }
  return extraPatch;
}

function savedGenerationEventType(input: StartGenerationInput): "assistant_message" | "user_message" {
  return input.impersonate === true ? "user_message" : "assistant_message";
}

function savedGenerationEventData(saved: unknown): unknown {
  if (!isRecord(saved)) return saved;
  const { swipes: _swipes, ...withoutSwipes } = saved;
  const extra = parseRecord(withoutSwipes.extra);
  const { generationPromptSnapshotsBySwipe: _generationPromptSnapshotsBySwipe, ...timelineExtra } = extra;
  return { ...withoutSwipes, extra: timelineExtra };
}

function messageId(saved: unknown): string | null {
  return isRecord(saved) ? readString(saved.id) || null : null;
}

function savedMessageExtra(saved: unknown): JsonRecord {
  return isRecord(saved) ? parseRecord(saved.extra) : {};
}

function savedMessageAttachments(saved: unknown): JsonRecord[] {
  const attachments = savedMessageExtra(saved).attachments;
  if (!Array.isArray(attachments)) return [];
  return attachments.filter((attachment): attachment is JsonRecord => isRecord(attachment));
}

async function patchSavedMessageAgentExtra(args: {
  storage: StorageGateway;
  saved: unknown;
  results: AgentResult[];
  contextInjections?: AgentInjectionOverride[] | null;
  spriteExpressions?: Record<string, string> | null;
}): Promise<unknown | null> {
  const id = messageId(args.saved);
  if (!id) return null;
  const existingExtra = savedMessageExtra(args.saved);
  const extraPatch = agentExtraFromResults({
    results: args.results,
    contextInjections: args.contextInjections,
    existingExtra,
    mergeContextInjectionUpdates: true,
  });
  if (args.spriteExpressions && Object.keys(args.spriteExpressions).length > 0) {
    extraPatch.spriteExpressions = args.spriteExpressions;
  }
  if (Object.keys(extraPatch).length === 0) return null;
  return args.storage.patchChatMessageExtra(id, extraPatch);
}

async function appendSavedMessageAttachments(args: {
  storage: StorageGateway;
  saved: unknown;
  attachments: JsonRecord[];
}): Promise<unknown | null> {
  const id = messageId(args.saved);
  if (!id || args.attachments.length === 0) return null;
  return args.storage.patchChatMessageExtra(id, {
    attachments: [...savedMessageAttachments(args.saved), ...args.attachments],
  });
}

async function persistAgentMessageExtraForTarget(
  storage: StorageGateway,
  target: JsonRecord | null,
  results: AgentResult[],
  contextInjections: AgentInjectionOverride[] | null,
  availableSprites: AvailableSpriteCharacter[],
): Promise<void> {
  const messageId = readString(target?.id).trim();
  if (!messageId) return;
  const extraPatch = agentExtraFromResults({
    results,
    contextInjections,
    existingExtra: target?.extra,
    mergeContextInjectionUpdates: true,
  });
  const spriteExpressions = spriteExpressionsFromAgentResults(results, availableSprites);
  if (spriteExpressions && Object.keys(spriteExpressions).length > 0) {
    extraPatch.spriteExpressions = spriteExpressions;
  }
  if (Object.keys(extraPatch).length === 0) return;
  await storage.patchChatMessageExtra(messageId, extraPatch);
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
  return new Set(
    stringArray(parseRecord(chat.metadata).activeAgentIds)
      .map((id) => id.trim())
      .filter(Boolean),
  );
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
      .filter((run) => readString(run.chatId || run.chat_id).trim() === chatId)
      .filter((run) => {
        const type = readString(run.agentType || run.agent_type || run.type).trim();
        const configId = readString(run.agentConfigId || run.agent_config_id).trim();
        return type === LOREBOOK_KEEPER_AGENT_TYPE || configId === `builtin:${LOREBOOK_KEEPER_AGENT_TYPE}`;
      })
      .filter((run) => boolish(run.success, false))
      .map((run) => readString(run.messageId || run.message_id).trim())
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
    .filter((message) => {
      if (!readString(message.id).trim()) return false;
      if (!Object.prototype.hasOwnProperty.call(message, "content")) return true;
      return !!readString(message.content).trim();
    });
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

function retryBypassesCustomAgentActivation(input: RetryAgentsInput): boolean {
  return boolish(parseRecord(input.options).bypassActivation, false);
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
}): Promise<{ results: AgentResult[]; events: GenerationEvent[] }> {
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
      fallbackTargets: resolveRegenerationGameStateFallbackMessageIds(storedMessages, targetTrackerTarget?.messageId),
    },
    trackerReadContext,
  );
  const targetSnapshot = await getTrackerSnapshotForTarget(
    deps.storage,
    chatId,
    targetTrackerTarget,
    trackerReadContext,
  );
  const chatForAgents =
    (targetSnapshot ?? retryBaseline) ? { ...chat, gameState: targetSnapshot ?? retryBaseline } : chat;
  const contextMessages = messagesBeforeTarget(storedMessages, target);
  const assembly = await assembleGenerationPrompt(deps.storage, {
    chat: chatForAgents,
    storedMessages: contextMessages,
    connection,
    request: input,
    latestUserInput: "",
    embeddingSource: generationEmbeddingSource(deps.llm, connection),
    persistPromptVariables: true,
  });
  const results: AgentResult[] = [];
  const runtime = await createGenerationAgentRuntime(
    { storage: deps.storage, llm: deps.llm, integrations: deps.integrations, visuals: deps.visuals },
    {
      chat: chatForAgents,
      connection,
      storedMessages: contextMessages,
      cadenceMessages: storedMessages,
      characters: assembly.characters,
      persona: assembly.persona,
      activatedLorebookEntries: assembly.activatedLorebookEntries,
      chatSummary: assembly.chatSummary,
      agentTypes,
      bypassCustomAgentActivation: retryBypassesCustomAgentActivation(input),
      hideAutomatedSummarySourceMessages: input.hideAutomatedSummarySourceMessages === true,
      signal,
      regenerateMessageId: readString(input.regenerateMessageId).trim() || null,
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
  await persistAgentMessageExtraForTarget(
    deps.storage,
    target,
    finalResults,
    runtime.preInjections,
    runtime.availableSprites,
  );
  if (target) {
    await persistTrackerSnapshotSafely(deps.storage, chatId, target, finalResults, retryBaseline, mainResponse);
  }
  await persistSecretPlotAgentMemorySafely(deps.storage, chatId, finalResults);
  await persistAgentResults(deps.storage, chatId, target ? readString(target.id) || null : null, finalResults);

  const events: GenerationEvent[] = [];
  const hasIllustrationRequest = finalResults.some((result) => illustratorPromptData(result) !== null);
  if (target && hasIllustrationRequest) {
    const illustration = await generateIllustrationAttachments({
      deps,
      chat: chatForAgents,
      results: finalResults,
      signal,
    });
    events.push(...illustration.events);
    await appendSavedMessageAttachments({
      storage: deps.storage,
      saved: target,
      attachments: illustration.attachments,
    });
  }

  return { results: finalResults, events };
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

  const storedMessages =
    args.storedMessages ??
    (
      await deps.storage.listChatMessages<unknown>(chatId, {
        fields: LOREBOOK_KEEPER_BACKFILL_TARGET_SCAN_FIELDS,
        fieldSelections: { extra: ["hiddenFromAI", "hiddenFromAi"] },
      })
    ).filter(isRecord);
  const processedMessageIds = await successfulLorebookKeeperMessageIds(deps.storage, chatId);
  const targets = lorebookKeeperBackfillTargets(storedMessages, processedMessageIds, {
    readBehind: lorebookKeeperReadBehind(args.chat),
    runInterval: lorebookKeeperRunInterval(agent),
  });
  const agentTypes = new Set([LOREBOOK_KEEPER_AGENT_TYPE]);
  const allResults: AgentResult[] = [];

  for (const target of targets) {
    const targetMessages = await loadMessagesForGenerationTarget({
      storage: deps.storage,
      chatId,
      chat: args.chat,
      input,
      targetMessageId: readString(target.message.id).trim(),
    });
    const hydratedTarget =
      targetMessages.find((message) => readString(message.id).trim() === readString(target.message.id).trim()) ??
      target.message;
    if (!readString(hydratedTarget.content).trim()) continue;
    allResults.push(
      ...(
        await runGenerationAgentsForTarget({
          deps,
          input,
          chat: args.chat,
          connection: args.connection,
          storedMessages: targetMessages,
          target: hydratedTarget,
          agentTypes,
          signal: args.signal,
        })
      ).results,
    );
  }

  return allResults;
}

export async function retryGenerationAgents(
  deps: GenerationEngineDeps,
  input: RetryAgentsInput,
  signal?: AbortSignal,
): Promise<{ results: AgentResult[]; events: GenerationEvent[] }> {
  const chatId = readString(input.chatId).trim();
  if (!chatId) throw new Error("chatId is required");
  const agentTypes = Array.isArray(input.agentTypes)
    ? new Set(input.agentTypes.map((type) => readString(type).trim()).filter(Boolean))
    : new Set<string>();
  const chat = requireRecord(await deps.storage.get("chats", chatId), "Chat");
  assertChatCanGenerate(chat);
  const connection = await resolveGenerationConnection(deps.storage, chat, input);
  if (isLorebookKeeperBackfill(input)) {
    return {
      results: await runLorebookKeeperBackfill(deps, input, { chat, connection, signal }),
      events: [],
    };
  }
  const targetMessageId = readString(input.options?.forMessageId).trim();
  const storedMessages = await loadMessagesForGenerationTarget({
    storage: deps.storage,
    chatId,
    chat,
    input,
    targetMessageId,
  });
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
  throwIfAborted(signal);
  const chat = requireRecord(await deps.storage.get("chats", chatId), "Chat");
  throwIfAborted(signal);
  const internalOptions = internalStartGenerationOptions.get(input) ?? {};
  input = await inputWithStoredGenerationReplay(deps.storage, chat, chatId, input);
  throwIfAborted(signal);
  assertChatCanGenerate(chat, input);

  yield { type: "phase", data: "Saving message..." };
  const preparedUserInput = await prepareUserInput(deps.storage, input);
  throwIfAborted(signal);
  const savesUserMessage = shouldSaveUserMessage(input, preparedUserInput, internalOptions);
  const messageLoadOptions = generationMessageLoadOptions(chat, input);
  let storedMessages: JsonRecord[] | null = null;
  if (savesUserMessage) {
    storedMessages = await loadChatMessages(deps.storage, chatId, messageLoadOptions);
    throwIfAborted(signal);
    await commitVisibleTrackerSnapshotSafely(deps.storage, chatId, storedMessages);
    throwIfAborted(signal);
  }
  const savedUserMessage = await saveUserMessage(deps.storage, chat, input, preparedUserInput, internalOptions);
  throwIfAborted(signal);
  if (savedUserMessage) yield { type: "user_message", data: savedGenerationEventData(savedUserMessage) };
  const connection = await resolveGenerationConnection(deps.storage, chat, input);
  throwIfAborted(signal);
  if (savesUserMessage) {
    const savedTimelineMessage = savedUserMessageForTimeline(savedUserMessage, chatId);
    storedMessages = savedTimelineMessage
      ? [...(storedMessages ?? []), savedTimelineMessage]
      : await loadChatMessages(deps.storage, chatId, messageLoadOptions);
  } else {
    storedMessages = await loadMessagesForGenerationTarget({ storage: deps.storage, chatId, chat, input });
  }
  let generationMessages = messagesBeforeRegenerationTarget(storedMessages, input.regenerateMessageId);
  const latestUserInput =
    readString(internalOptions.latestUserInput).trim() || preparedUserInput.content || inputUserMessage(input);
  if (internalOptions.groupTurnChild !== true) {
    const groupTurnIds = await resolveIndividualGroupTurnIds({
      deps,
      input,
      chat,
      connection,
      storedMessages: generationMessages,
      latestUserInput,
      mentionedNames: preparedUserInput.mentionedCharacterNames,
      signal,
    });
    throwIfAborted(signal);
    if (groupTurnIds) {
      if (groupTurnIds.length === 0) {
        yield { type: "done" };
        return;
      }
      yield* runIndividualGroupTurnLoop({ deps, input, turnIds: groupTurnIds, latestUserInput, signal });
      return;
    }
  }
  const sequentialGroupTargetId = sequentialGroupTargetCharacterId(chat, input, storedMessages);
  if (sequentialGroupTargetId) {
    input = { ...input, forCharacterId: sequentialGroupTargetId };
  }
  const generationTrackerBaseline = await selectGenerationTrackerBaseline(
    deps.storage,
    chatId,
    input,
    preparedUserInput,
    storedMessages,
  );
  const chatForGeneration = generationTrackerBaseline ? { ...chat, gameState: generationTrackerBaseline } : chat;
  const resolvedGroupTarget = await resolveGroupTargetForGeneration({
    deps,
    input,
    chat: chatForGeneration,
    connection,
    storedMessages: generationMessages,
    latestUserInput,
    mentionedNames: preparedUserInput.mentionedCharacterNames,
    signal,
  });
  throwIfAborted(signal);
  if (resolvedGroupTarget && readString(input.forCharacterId).trim() !== resolvedGroupTarget) {
    input = { ...input, forCharacterId: resolvedGroupTarget };
  }
  const directMessages = requestMessages(input);
  if (!directMessages && input.impersonate !== true) {
    const availability = await resolveConversationAvailability({
      storage: deps.storage,
      chat,
      targetCharacterId: readString(input.forCharacterId).trim() || resolvedGroupTarget,
    });
    throwIfAborted(signal);
    const characterNames = availability?.characters.map((character) => character.name) ?? [];
    const regenerateMessageId = readString(input.regenerateMessageId).trim();
    if (availability?.allOffline && !regenerateMessageId) {
      mirrorSavedUserMessageToDiscord({
        deps,
        chat,
        input,
        prepared: preparedUserInput,
        persona: savedUserPersonaContext(savedUserMessage),
      });
      yield { type: "offline", data: { characters: characterNames } };
      yield { type: "done" };
      return;
    }
    if (availability && availability.delayMs > 0 && !regenerateMessageId) {
      yield {
        type: "delayed",
        data: {
          characters: characterNames,
          status: availability.delayStatus,
          delayMs: availability.delayMs,
        },
      };
      await abortableDelay(availability.delayMs, signal);
      throwIfAborted(signal);
      storedMessages = await loadMessagesForGenerationTarget({ storage: deps.storage, chatId, chat, input });
      generationMessages = messagesBeforeRegenerationTarget(storedMessages, input.regenerateMessageId);
    }
    if (characterNames.length > 0) {
      yield { type: "typing", data: { characters: characterNames } };
    }
  }
  const agentEvents: AgentResult[] = [];
  const continueAssistantResponse = shouldContinueAssistantResponse(input, preparedUserInput, generationMessages);
  const agentInjectionOverrides = normalizedAgentInjectionOverrides(input);

  yield { type: "phase", data: "Assembling prompt..." };
  let prompt = directMessages;
  let assembly = await assembleGenerationPrompt(deps.storage, {
    chat: chatForGeneration,
    storedMessages: generationMessages,
    connection,
    request: input,
    latestUserInput,
    embeddingSource: generationEmbeddingSource(deps.llm, connection),
    persistPromptVariables: true,
  });
  throwIfAborted(signal);
  mirrorSavedUserMessageToDiscord({ deps, chat, input, prepared: preparedUserInput, persona: assembly.persona });

  if (!directMessages) {
    const agentsEnabled = input.impersonateBlockAgents !== true;
    yield { type: "phase", data: agentsEnabled ? "Running pre-generation agents..." : "Calling model..." };
    const runtime = agentsEnabled
      ? await createGenerationAgentRuntime(
          { storage: deps.storage, llm: deps.llm, integrations: deps.integrations, visuals: deps.visuals },
          {
            chat: chatForGeneration,
            connection,
            storedMessages: generationMessages,
            cadenceMessages: storedMessages,
            characters: assembly.characters,
            persona: assembly.persona,
            activatedLorebookEntries: assembly.activatedLorebookEntries,
            chatSummary: assembly.chatSummary,
            debugMode: input.debugMode === true,
            debugSink: input.debugSink,
            hideAutomatedSummarySourceMessages: input.hideAutomatedSummarySourceMessages === true,
            signal,
            forCharacterId: readString(input.forCharacterId).trim() || null,
            regenerateMessageId: readString(input.regenerateMessageId).trim() || null,
            agentInjectionOverrides,
          },
          (result) => agentEvents.push(result),
        )
      : null;
    throwIfAborted(signal);
    for (const result of agentEvents) {
      yield { type: "agent_result", data: result };
    }
    agentEvents.length = 0;

    if (runtime && shouldPauseForAgentInjectionReview(chatForGeneration, input, runtime.preInjections)) {
      yield {
        type: "agent_injection_review",
        data: {
          chatId,
          injections: runtime.preInjections.map((injection) => ({
            agentType: injection.agentType,
            agentName: injection.agentName || injection.agentType,
            text: injection.text,
          })),
        },
      };
      yield { type: "done" };
      return;
    }

    assembly = await assembleGenerationPrompt(deps.storage, {
      chat: chatForGeneration,
      storedMessages: generationMessages,
      connection,
      request: input,
      latestUserInput,
      agentData: runtime?.agentData,
      embeddingSource: generationEmbeddingSource(deps.llm, connection),
      persistPromptVariables: true,
    });
    throwIfAborted(signal);
    await consumePendingConnectedInfluences(deps.storage, chatForGeneration);
    throwIfAborted(signal);
    prompt = withImageAttachments(
      [
        ...assembly.messages,
        ...directiveMessages(input, chat, assembly.characters, assembly.persona, preparedUserInput, {
          continueAssistantResponse,
        }),
      ],
      preparedUserInput.images,
    );

    const parallelAgents = runtime?.runParallel() ?? Promise.resolve<AgentResult[]>([]);
    yield { type: "phase", data: "Calling model..." };
    const mainTools = await buildMainToolDefinitions({
      chat: chatForGeneration,
      storage: deps.storage,
      integrations: deps.integrations,
    });
    const toolRuntimeInput: ToolRuntimeInput = {
      chat: chatForGeneration,
      storedMessages: generationMessages,
      activatedLorebookEntries: assembly.activatedLorebookEntries,
      characters: assembly.characters,
      persona: assembly.persona,
      chatSummary: assembly.chatSummary,
      hideAutomatedSummarySourceMessages: input.hideAutomatedSummarySourceMessages === true,
    };
    const baseMessages: LlmMessage[] = [...prompt, generationGuide(input, runtime?.preInjections)].filter(
      (message): message is LlmMessage => !!message,
    );
    const {
      content: streamedContent,
      thinking: streamedThinking,
      usage,
      promptSnapshot,
    } = yield* streamMainGenerationLoop({
      deps,
      connection,
      input,
      chat: chatForGeneration,
      parameters: llmParameters(connection, input, chatForGeneration, assembly.parameters),
      baseMessages,
      promptPresetId: assembly.promptPresetId,
      mainTools,
      toolRuntimeInput,
      signal,
    });
    throwIfAborted(signal);
    let content = streamedContent;

    const preSaveAgentResults = uniqueAgentResults(runtime?.preResults ?? []);
    const preSaveSpriteExpressions = spriteExpressionsFromAgentResults(
      preSaveAgentResults,
      runtime?.availableSprites ?? [],
    );
    content = await applyRuntimeRegexScripts(deps.storage, "ai_output", content);
    throwIfAborted(signal);
    const connected = await persistConnectedCommandTags(
      deps.storage,
      chat,
      content,
      deps.integrations,
      deps.llm,
      readString(connection.id) || input.connectionId || null,
      input.imagePromptSettings,
      deps.visuals,
    );
    throwIfAborted(signal);
    for (const event of connected.events) yield event;
    const saved = connected.suppressAssistantMessage
      ? null
      : await saveAssistantMessage({
          storage: deps.storage,
          chat,
          input,
          connection,
          content: connected.displayContent,
          thinking: streamedThinking,
          agentResults: preSaveAgentResults,
          noteCount: connected.createdNotes.length + connected.executedCommands.length,
          chatSummaryFingerprint: assembly.chatSummaryFingerprint,
          attachments: connected.assistantAttachments,
          usage,
          promptSnapshot,
          spriteExpressions: preSaveSpriteExpressions,
          contextInjections: runtime?.preInjections ?? null,
        });
    let latestSaved = saved;
    if (saved) {
      await persistLorebookTimingStatesSafely(
        deps.storage,
        chatId,
        assembly.lorebookTimingStates,
        assembly.lorebookEntryStateOverrides,
      );
    }
    throwIfAborted(signal);
    if (saved && input.impersonate !== true) {
      await mirrorSavedAssistantMessageToDiscord({
        deps,
        chat,
        input,
        saved,
        content: connected.displayContent,
        characters: assembly.characters,
      });
    }
    if (saved) yield { type: savedGenerationEventType(input), data: savedGenerationEventData(saved) };
    if (saved && input.impersonate !== true) {
      await evictStalePromptSnapshotsSafely(deps.storage, chatId);
    }
    throwIfAborted(signal);

    const parallelResults = await parallelAgents;
    throwIfAborted(signal);
    const postResults = runtime ? await runtime.runPost(content) : [];
    throwIfAborted(signal);
    const emittedAgentResults = uniqueAgentResults([...parallelResults, ...postResults, ...agentEvents]);
    for (const result of emittedAgentResults) {
      yield { type: "agent_result", data: result };
    }
    agentEvents.length = 0;
    const allAgentResults = uniqueAgentResults([...preSaveAgentResults, ...emittedAgentResults]);
    const spriteExpressions = spriteExpressionsFromAgentResults(allAgentResults, runtime?.availableSprites ?? []);
    if (saved) {
      const patched = await patchSavedMessageAgentExtra({
        storage: deps.storage,
        saved: latestSaved,
        results: allAgentResults,
        contextInjections: runtime?.preInjections ?? null,
        spriteExpressions,
      });
      if (patched) {
        latestSaved = patched;
        yield { type: savedGenerationEventType(input), data: savedGenerationEventData(patched) };
      }
    }

    const hasIllustrationRequest = emittedAgentResults.some((result) => illustratorPromptData(result) !== null);
    if (saved && hasIllustrationRequest) {
      yield { type: "phase", data: "Generating illustration..." };
      const illustration = await generateIllustrationAttachments({
        deps,
        chat,
        results: emittedAgentResults,
        signal,
      });
      throwIfAborted(signal);
      for (const event of illustration.events) yield event;
      const patched = await appendSavedMessageAttachments({
        storage: deps.storage,
        saved: latestSaved,
        attachments: illustration.attachments,
      });
      if (patched) {
        latestSaved = patched;
        yield { type: savedGenerationEventType(input), data: savedGenerationEventData(patched) };
      }
    }
    throwIfAborted(signal);
    if (saved && input.impersonate !== true) {
      await persistTrackerSnapshotSafely(
        deps.storage,
        chatId,
        latestSaved,
        allAgentResults,
        generationTrackerBaseline,
        readString(parseRecord(latestSaved).content),
      );
    }
    throwIfAborted(signal);
    await persistSecretPlotAgentMemorySafely(deps.storage, chatId, allAgentResults);
    throwIfAborted(signal);
    await persistAgentResults(deps.storage, chatId, messageId(latestSaved), allAgentResults);
    throwIfAborted(signal);
    if (saved && input.impersonate !== true) {
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
    if (saved && input.impersonate !== true) {
      await refreshMemoryRecallSafely(deps.storage, chat);
    }
    yield { type: "done", data: { transcript: visibleTranscript(generationMessages) } };
    return;
  }

  prompt = withImageAttachments(
    [
      ...(prompt ?? []),
      ...directiveMessages(input, chat, assembly.characters, assembly.persona, preparedUserInput, {
        continueAssistantResponse,
      }),
    ],
    preparedUserInput.images,
  );
  yield { type: "phase", data: "Calling model..." };
  const mainToolsDirect = await buildMainToolDefinitions({
    chat: chatForGeneration,
    storage: deps.storage,
    integrations: deps.integrations,
  });
  const toolRuntimeInputDirect: ToolRuntimeInput = {
    chat: chatForGeneration,
    storedMessages: generationMessages,
    activatedLorebookEntries: assembly.activatedLorebookEntries,
    characters: assembly.characters,
    persona: assembly.persona,
    chatSummary: assembly.chatSummary,
    hideAutomatedSummarySourceMessages: input.hideAutomatedSummarySourceMessages === true,
  };
  const baseMessagesDirect: LlmMessage[] = [...(prompt ?? []), generationGuide(input)].filter(
    (message): message is LlmMessage => !!message,
  );
  const {
    content: streamedContentDirect,
    thinking: streamedThinkingDirect,
    usage,
    promptSnapshot: promptSnapshotDirect,
  } = yield* streamMainGenerationLoop({
    deps,
    connection,
    input,
    chat: chatForGeneration,
    parameters: llmParameters(connection, input, chatForGeneration, assembly.parameters),
    baseMessages: baseMessagesDirect,
    promptPresetId: assembly.promptPresetId,
    mainTools: mainToolsDirect,
    toolRuntimeInput: toolRuntimeInputDirect,
    signal,
  });
  throwIfAborted(signal);
  let content = streamedContentDirect;
  content = await applyRuntimeRegexScripts(deps.storage, "ai_output", content);
  throwIfAborted(signal);
  const connected = await persistConnectedCommandTags(
    deps.storage,
    chat,
    content,
    deps.integrations,
    deps.llm,
    readString(connection.id) || input.connectionId || null,
    input.imagePromptSettings,
    deps.visuals,
  );
  throwIfAborted(signal);
  for (const event of connected.events) yield event;
  const saved = connected.suppressAssistantMessage
    ? null
    : await saveAssistantMessage({
        storage: deps.storage,
        chat,
        input,
        connection,
        content: connected.displayContent,
        thinking: streamedThinkingDirect,
        agentResults: [],
        noteCount: connected.createdNotes.length + connected.executedCommands.length,
        chatSummaryFingerprint: assembly.chatSummaryFingerprint,
        attachments: connected.assistantAttachments,
        usage,
        promptSnapshot: promptSnapshotDirect,
      });
  if (saved) {
    await persistLorebookTimingStatesSafely(
      deps.storage,
      chatId,
      assembly.lorebookTimingStates,
      assembly.lorebookEntryStateOverrides,
    );
  }
  throwIfAborted(signal);
  if (saved && input.impersonate !== true) {
    await mirrorSavedAssistantMessageToDiscord({
      deps,
      chat,
      input,
      saved,
      content: connected.displayContent,
      characters: assembly.characters,
    });
  }
  if (saved) yield { type: savedGenerationEventType(input), data: savedGenerationEventData(saved) };
  if (saved && input.impersonate !== true) {
    await evictStalePromptSnapshotsSafely(deps.storage, chatId);
  }
  throwIfAborted(signal);
  if (saved && input.impersonate !== true) {
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
  if (saved && input.impersonate !== true) {
    await refreshMemoryRecallSafely(deps.storage, chat);
  }
  yield { type: "done" };
}

function generationGuide(
  input: StartGenerationInput,
  contextInjections: readonly AgentInjectionOverride[] | null | undefined = null,
): LlmMessage | null {
  const guides = [
    readString(input.generationGuide).trim(),
    buildProseGuardianAvoidanceGuide(contextInjections) ?? "",
  ].filter((guide) => guide.length > 0);
  return guides.length > 0 ? { role: "user", content: guides.join("\n\n") } : null;
}

function runtimeLlmParameters(
  connection: JsonRecord,
  input: StartGenerationInput,
  chat: JsonRecord,
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  if (readString(connection.provider).trim() !== "claude_subscription") return parameters;
  return {
    ...parameters,
    _marinara: {
      chatId: readString(chat.id).trim() || readString(input.chatId).trim(),
      mode: readString(chat.mode || chat.chatMode).trim(),
      regenerateMessageId: readString(input.regenerateMessageId).trim() || null,
      impersonate: input.impersonate === true,
    },
  };
}

/**
 * Cap on the number of stream → tool-execute → re-stream iterations the main
 * generation loop will perform before forcing a final turn. Picked defensively
 * to cover realistic multi-step flows (e.g. Spotify-style 4-hop sequences,
 * combat-style dice + state-update interleaves) while preventing runaway loops
 * from broken models that always emit a tool call.
 */
const MAX_MAIN_TOOL_ITERATIONS = 8;

function llmChunkText(chunk: { text?: unknown; data?: unknown }): string {
  return typeof chunk.text === "string" ? chunk.text : typeof chunk.data === "string" ? chunk.data : "";
}

/**
 * Multi-turn main-character streaming loop.
 *
 * Streams from the LLM, collects any `tool_call` chunks, executes them via
 * `executeMainToolCall`, appends the assistant turn + tool results to the
 * conversation, and re-streams until the model produces a turn with no tool
 * calls (or the iteration cap is hit).
 *
 * Mode-blind by construction: this helper reads no chat-mode flag. The only
 * gate on the tool loop is `mainTools !== null`, which the caller derives from
 * `chat.metadata.enableTools` via `buildMainToolDefinitions`.
 *
 * Tool-result messages are conversation-internal — they are NOT persisted as
 * chat messages. Only the final accumulated text reaches `saveAssistantMessage`.
 */
async function* streamMainGenerationLoop(args: {
  deps: GenerationEngineDeps;
  connection: JsonRecord;
  input: StartGenerationInput;
  chat: JsonRecord;
  parameters: Record<string, unknown>;
  baseMessages: LlmMessage[];
  promptPresetId?: string | null;
  mainTools: MainToolDefinitions | null;
  toolRuntimeInput: ToolRuntimeInput;
  signal: AbortSignal | undefined;
}): AsyncGenerator<
  GenerationEvent,
  { content: string; thinking: string; usage: unknown; promptSnapshot: MainGenerationPromptSnapshot | null }
> {
  const {
    deps,
    connection,
    input,
    chat,
    parameters,
    baseMessages,
    promptPresetId,
    mainTools,
    toolRuntimeInput,
    signal,
  } = args;
  let content = "";
  let thinking = "";
  const usages: unknown[] = [];
  const conversation: LlmMessage[] = [...baseMessages];
  let promptSnapshot: MainGenerationPromptSnapshot | null = null;
  let iteration = 0;

  while (true) {
    throwIfAborted(signal);
    iteration++;
    const pendingToolCalls: LLMToolCall[] = [];
    let turnContent = "";
    const thinkingParser = createInlineThinkingStreamParser();
    const emitInlineParts = function* (text: string): Generator<GenerationEvent> {
      for (const part of thinkingParser.push(text)) {
        if (!part.text) continue;
        if (part.type === "thinking") {
          thinking += part.text;
          yield { type: "thinking", data: part.text };
        } else {
          turnContent += part.text;
          yield { type: "token", data: part.text };
        }
      }
    };

    const requestMessages = fitMessagesToContextWindow(conversation, parameters);
    const requestParameters = runtimeLlmParameters(connection, input, chat, parameters);
    const visibleRequestParameters = providerVisibleLlmParameters(connection, requestParameters, { stream: true });
    const requestTools = mainTools?.toolDefs;
    promptSnapshot = {
      messages: requestMessages.map(clonePromptMessage),
      parameters: cloneSerializableValue(visibleRequestParameters),
      promptPresetId: promptPresetId ?? null,
      ...(requestTools?.length ? { tools: cloneSerializableValue(requestTools) } : {}),
    };

    for await (const chunk of deps.llm.stream(
      {
        connectionId: readString(connection.id) || input.connectionId,
        model: readString(connection.model) || undefined,
        messages: requestMessages,
        parameters: requestParameters,
        tools: requestTools,
      },
      signal,
    )) {
      throwIfAborted(signal);
      if (chunk.type === "token") {
        const text = llmChunkText(chunk);
        if (text) yield* emitInlineParts(text);
      } else if (chunk.type === "thinking") {
        const text = llmChunkText(chunk);
        if (text) {
          thinking += text;
          yield { type: "thinking", data: text };
        }
      } else if (chunk.type === "tool_call") {
        const normalized = normalizeToolCall(chunk.data);
        if (normalized) pendingToolCalls.push(normalized);
      } else if (chunk.type === "usage" && chunk.data != null) {
        usages.push(chunk.data);
      }
    }
    for (const part of thinkingParser.flush()) {
      if (!part.text) continue;
      if (part.type === "thinking") {
        thinking += part.text;
        yield { type: "thinking", data: part.text };
      } else {
        turnContent += part.text;
        yield { type: "token", data: part.text };
      }
    }

    throwIfAborted(signal);
    content += turnContent;

    if (!mainTools || pendingToolCalls.length === 0) break;
    if (iteration >= MAX_MAIN_TOOL_ITERATIONS) {
      yield {
        type: "phase",
        data: `Tool-call iteration limit (${MAX_MAIN_TOOL_ITERATIONS}) reached; finishing without further tool calls.`,
      };
      break;
    }

    conversation.push({
      role: "assistant",
      content: turnContent,
      tool_calls: pendingToolCalls,
    });

    for (const call of pendingToolCalls) {
      throwIfAborted(signal);
      const toolName = call.function?.name || call.name;
      const toolArgs = call.function?.arguments || call.arguments || "{}";
      yield { type: "tool_call", data: { id: call.id, name: toolName, arguments: toolArgs } };
      let resultText: string;
      let success = true;
      try {
        resultText = await executeMainToolCall({
          deps: { storage: deps.storage, integrations: deps.integrations },
          input: toolRuntimeInput,
          customTools: mainTools.customTools,
          allowedToolNames: mainTools.allowedToolNames,
          call,
        });
      } catch (err) {
        success = false;
        resultText = err instanceof Error ? err.message : String(err);
      }
      throwIfAborted(signal);
      yield {
        type: "tool_result",
        data: { toolCallId: call.id, name: toolName, result: resultText, success },
      };
      conversation.push({
        role: "tool",
        content: resultText,
        tool_call_id: call.id,
        name: toolName,
      });
    }
  }

  return { content, thinking, usage: mergeUsages(usages), promptSnapshot };
}

/**
 * Aggregate per-turn usage records across a multi-turn tool-call loop.
 *
 * Each LLM turn (every iteration of `streamMainGenerationLoop`) emits its own
 * `usage` chunk. When the loop runs once with no tool calls, behavior is
 * byte-identical to the pre-loop world — the single record is returned as-is.
 * When the loop iterates 2+ times, numeric leaf fields (prompt/completion/total
 * tokens, cached/reasoning/cost breakdowns) are summed so downstream
 * `generationInfo.usage` reflects total cost, not just the final turn's slice.
 *
 * Falls back to the latest non-null entry when usages have heterogeneous shapes
 * (different providers, different keys) so we never silently report wrong-typed
 * data.
 */
function mergeUsages(usages: unknown[]): unknown {
  if (usages.length === 0) return null;
  if (usages.length === 1) return usages[0];
  const records = usages.filter(isRecord);
  if (records.length === 0) return usages[usages.length - 1] ?? null;
  const merged: Record<string, unknown> = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        const prev = merged[key];
        merged[key] = typeof prev === "number" && Number.isFinite(prev) ? prev + value : value;
      } else if (!(key in merged)) {
        merged[key] = value;
      }
    }
  }
  return merged;
}
