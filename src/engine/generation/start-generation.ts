import { BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS, type AgentContext, type AgentResult } from "../contracts/types/agent";
import type { GenerationPromptSnapshot, GenerationPromptSnapshotMessage } from "../contracts/types/chat";
import type { GameState } from "../contracts/types/game-state";
import type { EventGateway } from "../capabilities/events";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway, LlmMessage } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import type { VisualAssetGateway } from "../capabilities/visual-assets";
import type { GenerationGuideSource } from "../shared/text/generation-guide";
import { chatSummaryFingerprintMatches, fingerprintChatSummary } from "../shared/text/chat-summary-fingerprint";
import { collapseExcessBlankLines } from "../shared/text/newlines";
import { buildImpersonateInstruction } from "../modes/chat/commands/impersonate-prompt";
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
  type GenerationReplay,
} from "./generation-replay";
import { assembleGenerationPrompt, chatSummaryForGeneration } from "./prompt-assembly";
import type { GenerationCharacterContext, GenerationPersonaContext } from "./prompt-assembly";
import { generationInfoFromVisibleParameters, providerVisibleLlmParameters } from "./provider-visible-parameters";
import { applyRuntimeRegexScripts } from "./regex-runtime";
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

const LOREBOOK_KEEPER_AGENT_TYPE = "lorebook-keeper";
const DEFAULT_LOREBOOK_KEEPER_RUN_INTERVAL = BUILT_IN_AGENT_RUN_INTERVAL_DEFAULTS[LOREBOOK_KEEPER_AGENT_TYPE] ?? 8;

const CONTINUE_ASSISTANT_RESPONSE_INSTRUCTION =
  "[Generation instruction: continue from the latest assistant message. Do not repeat or summarize the previous response; pick up naturally from where it stopped.]";

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
  appearance: string;
  avatar: string;
};

type IllustrationReferenceData = {
  referenceImages: string[];
  appearanceNotes: string[];
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

function compactAppearance(value: unknown, limit = 360): string {
  const text = collapseExcessBlankLines(readString(value)).replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3).trimEnd()}...` : text;
}

function recordName(record: JsonRecord): string {
  const data = parseRecord(record.data);
  return readString(data.name).trim() || readString(record.name).trim();
}

function recordAppearance(record: JsonRecord): string {
  const data = parseRecord(record.data);
  const extensions = parseRecord(data.extensions);
  return compactAppearance(
    readString(extensions.appearance).trim() ||
      readString(data.appearance).trim() ||
      readString(data.description).trim() ||
      readString(record.description).trim(),
  );
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
      boolish(settings.useAvatarReferences, false) || boolish(meta.illustrationUseAvatarReferences, false),
  };
}

async function loadIllustrationReferenceSubjects(
  storage: StorageGateway,
  chat: JsonRecord,
): Promise<IllustrationReferenceSubject[]> {
  const characterRows = await Promise.all(
    activeCharacterIds(chat).map((id) => storage.get<JsonRecord>("characters", id).catch(() => null)),
  );
  const subjects = characterRows.filter(isRecord).map((row) => ({
    id: readString(row.id).trim(),
    name: recordName(row),
    appearance: recordAppearance(row),
    avatar: recordAvatar(row),
  }));
  const personaId = readString(chat.personaId).trim();
  const persona = personaId ? await storage.get<JsonRecord>("personas", personaId).catch(() => null) : null;
  if (isRecord(persona)) {
    subjects.push({
      id: personaId || readString(persona.id).trim(),
      name: recordName(persona),
      appearance: recordAppearance(persona),
      avatar: recordAvatar(persona),
    });
  }
  return subjects.filter((subject) => subject.id && subject.name);
}

async function illustrationReferenceData(args: {
  storage: StorageGateway;
  visuals?: VisualAssetGateway;
  chat: JsonRecord;
  item: IllustrationPromptData;
  includeAppearances: boolean;
  useAvatarReferences: boolean;
}): Promise<IllustrationReferenceData> {
  const subjects = (await loadIllustrationReferenceSubjects(args.storage, args.chat)).filter((subject) =>
    matchesIllustrationSubject(subject, args.item),
  );
  const referenceImages: string[] = [];
  const appearanceNotes: string[] = [];
  for (const subject of subjects) {
    if (args.includeAppearances && subject.appearance) {
      appearanceNotes.push(`${subject.name}: ${subject.appearance}`);
    }
    if (!args.useAvatarReferences) continue;
    const sprites = args.visuals ? await args.visuals.listSprites(subject.id).catch(() => []) : [];
    const spriteReference = fullBodySpriteReference(sprites as Array<Record<string, unknown>>);
    const reference = spriteReference || subject.avatar;
    if (reference) referenceImages.push(reference);
  }
  return { referenceImages, appearanceNotes };
}

function appendAppearanceNotes(prompt: string, notes: string[]): string {
  if (notes.length === 0) return prompt.trim();
  return `${prompt.trim()}\n\nVisible character appearance notes:\n${notes.map((note) => `- ${note}`).join("\n")}`;
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
  imagePromptSettings?: StartGenerationInput["imagePromptSettings"];
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
  const includeAppearances = args.imagePromptSettings?.includeAppearances !== false;
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
        includeAppearances,
        useAvatarReferences: settings.useAvatarReferences,
      });
      const prompt = appendAppearanceNotes(
        appendMissingPositiveTags(item.prompt, settings.positivePrompt),
        referenceData.appearanceNotes,
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
        characters: item.characterNames,
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
  if (readString(input.regenerateMessageId).trim()) return undefined;
  const chatLimit = readNumber(parseRecord(chat.metadata).contextMessageLimit, 0);
  if (chatLimit <= 0 && !Number.isFinite(Number(input.historyLimit))) return undefined;
  const historyLimit = Math.max(1, Math.min(9999, chatLimit || readNumber(input.historyLimit, 300)));
  return { limit: Math.max(40, Math.min(340, historyLimit + 20)) };
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
        customPrompt: input.impersonatePromptTemplate,
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

function sequentialRoleplayGroupTarget(messages: JsonRecord[], activeIds: string[]): string | null {
  if (activeIds.length === 0) return null;
  const lastCharacterId = lastVisibleAssistantCharacterId(messages, activeIds);
  if (!lastCharacterId) return activeIds[0] ?? null;
  const index = activeIds.indexOf(lastCharacterId);
  return activeIds[(index + 1) % activeIds.length] ?? activeIds[0] ?? null;
}

function explicitRoleplayGroupTarget(
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
  const targetCharacterId = readString(target?.characterId).trim();
  return active.has(targetCharacterId) ? targetCharacterId : null;
}

function continuationRoleplayGroupTarget(args: {
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
  const candidates = await loadSmartResponderCandidates(args.deps.storage, args.activeIds);
  const mentionedIds = mentionedSmartResponderIds({
    candidates,
    latestUserInput: args.latestUserInput,
    mentionedNames: args.mentionedNames,
  });
  if (mentionedIds.length > 0) return mentionedIds[0] ?? null;
  if (candidates.length === 0) return sequentialRoleplayGroupTarget(args.storedMessages, args.activeIds);

  const personaId = readString(args.chat.personaId).trim();
  const persona = personaId ? await args.deps.storage.get<JsonRecord>("personas", personaId).catch(() => null) : null;
  const personaData = isRecord(persona) ? characterDataRecord(persona) : {};
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
            content:
              'You are a hidden response orchestrator for an individual-mode roleplay group chat. Choose which character should respond next based on the latest message, direct address, narrative momentum, and talkativeness. Usually choose exactly one character. Return only JSON: {"characterIds":["character-id"],"reason":"short"}.',
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
  return (
    parseSmartGroupSelectionIds(raw, args.activeIds)[0] ??
    sequentialRoleplayGroupTarget(args.storedMessages, args.activeIds)
  );
}

async function resolveRoleplayGroupTargetForGeneration(args: {
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
  const activeIds = roleplayIndividualGroupCharacterIds(args.chat);
  if (activeIds.length === 0) return null;
  const explicit = explicitRoleplayGroupTarget(args.input, args.storedMessages, activeIds);
  if (explicit) return explicit;
  const continuation = continuationRoleplayGroupTarget({
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
  return sequentialRoleplayGroupTarget(args.storedMessages, activeIds);
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
): Promise<void> {
  const target = trackerSnapshotTargetFromMessage(targetMessage);
  if (!target) return;
  try {
    await persistTrackerSnapshotForTurn(storage, chatId, target, results, { baseSnapshot });
  } catch (error) {
    console.warn("[generation] tracker snapshot persist failed", error);
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

function spriteExpressionsFromAgentResults(results: AgentResult[]): Record<string, string> | null {
  const expressions: Record<string, string> = {};
  for (const result of results) {
    if (!result.success || result.agentType !== "expression") continue;
    const data = parseRecord(result.data);
    const entries = Array.isArray(data.expressions) ? data.expressions : [];
    for (const entry of entries) {
      const record = parseRecord(entry);
      const expression = readString(record.expression).trim();
      if (!expression) continue;
      const characterId = readString(record.characterId).trim();
      const characterName = readString(record.characterName).trim();
      if (characterId) expressions[characterId] = expression;
      if (characterName) expressions[characterName] = expression;
    }
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
              generationPromptSnapshotsBySwipe: { "0": promptSnapshot },
            }
          : {}),
        chatSummaryFingerprint: args.chatSummaryFingerprint,
      },
    });
  }

  if (regenerateMessageId) {
    return saveRegeneratedMessage({
      storage: args.storage,
      chatId: args.input.chatId,
      messageId: regenerateMessageId,
      content,
      thinking: thinking || undefined,
      generationReplay,
      chatSummaryFingerprint: args.chatSummaryFingerprint,
      promptSnapshot,
      spriteExpressions: args.spriteExpressions,
      agentExtra,
    });
  }

  const requestedCharacterId = readString(args.input.forCharacterId).trim();
  const chatCharacterIdList = activeCharacterIds(args.chat);
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
            generationPromptSnapshotsBySwipe: { "0": promptSnapshot },
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
  const updated = await args.storage.addChatMessageSwipe(
    args.chatId,
    args.messageId,
    collapseExcessBlankLines(args.content),
    { extra: swipeExtra },
  );
  const updatedRecord = isRecord(updated) ? updated : {};
  const activeSwipeIndex = Math.max(0, Math.trunc(readNumber(updatedRecord.activeSwipeIndex, 0)));
  const extraPatch = generationReplayExtraPatch({
    generationReplay: args.generationReplay,
    chatSummaryFingerprint: args.chatSummaryFingerprint,
    thinking: args.thinking,
    promptSnapshot: args.promptSnapshot,
    spriteExpressions: args.spriteExpressions,
    agentExtra: args.agentExtra,
    activeSwipeIndex,
    existingExtra: parseRecord(updatedRecord.extra),
  });
  return args.storage.patchChatMessageExtra(args.messageId, extraPatch);
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
  activeSwipeIndex?: number | null;
  existingExtra?: JsonRecord | null;
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
    const activeSwipeIndex =
      typeof args.activeSwipeIndex === "number" && Number.isFinite(args.activeSwipeIndex)
        ? Math.max(0, Math.trunc(args.activeSwipeIndex))
        : 0;
    extraPatch.generationPromptSnapshot = args.promptSnapshot;
    extraPatch.generationPromptSnapshotsBySwipe = {
      ...parseRecord(args.existingExtra?.generationPromptSnapshotsBySwipe),
      [String(activeSwipeIndex)]: args.promptSnapshot,
    };
  }
  return extraPatch;
}

function savedGenerationEventType(input: StartGenerationInput): "assistant_message" | "user_message" {
  return input.impersonate === true ? "user_message" : "assistant_message";
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
): Promise<void> {
  const messageId = readString(target?.id).trim();
  if (!messageId) return;
  const extraPatch = agentExtraFromResults({
    results,
    contextInjections,
    existingExtra: target?.extra,
    mergeContextInjectionUpdates: true,
  });
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
  await persistAgentMessageExtraForTarget(deps.storage, target, finalResults, runtime.preInjections);
  if (target) {
    await persistTrackerSnapshotSafely(deps.storage, chatId, target, finalResults, retryBaseline);
  }
  await persistSecretPlotAgentMemorySafely(deps.storage, chatId, finalResults);
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
  throwIfAborted(signal);
  const chat = requireRecord(await deps.storage.get("chats", chatId), "Chat");
  throwIfAborted(signal);
  input = await inputWithStoredGenerationReplay(deps.storage, chat, chatId, input);
  throwIfAborted(signal);
  assertChatCanGenerate(chat, input);

  yield { type: "phase", data: "Saving message..." };
  const preparedUserInput = await prepareUserInput(deps.storage, input);
  throwIfAborted(signal);
  const savesUserMessage = shouldSaveUserMessage(input, preparedUserInput);
  const messageLoadOptions = generationMessageLoadOptions(chat, input);
  let storedMessages: JsonRecord[] | null = null;
  if (savesUserMessage) {
    storedMessages = await loadChatMessages(deps.storage, chatId, messageLoadOptions);
    throwIfAborted(signal);
    await commitVisibleTrackerSnapshotSafely(deps.storage, chatId, storedMessages);
    throwIfAborted(signal);
  }
  const savedUserMessage = await saveUserMessage(deps.storage, input, preparedUserInput);
  throwIfAborted(signal);
  if (savedUserMessage) yield { type: "user_message", data: savedUserMessage };
  const connection = await resolveGenerationConnection(deps.storage, chat, input);
  throwIfAborted(signal);
  if (savesUserMessage) {
    const savedTimelineMessage = savedUserMessageForTimeline(savedUserMessage, chatId);
    storedMessages = savedTimelineMessage
      ? [...(storedMessages ?? []), savedTimelineMessage]
      : await loadChatMessages(deps.storage, chatId, messageLoadOptions);
  } else {
    storedMessages = await loadChatMessages(deps.storage, chatId, messageLoadOptions);
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
  const latestUserInput = preparedUserInput.content || inputUserMessage(input);
  const resolvedRoleplayGroupTarget = await resolveRoleplayGroupTargetForGeneration({
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
  if (resolvedRoleplayGroupTarget && readString(input.forCharacterId).trim() !== resolvedRoleplayGroupTarget) {
    input = { ...input, forCharacterId: resolvedRoleplayGroupTarget };
  }
  const directMessages = requestMessages(input);
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
    const baseMessages: LlmMessage[] = [...prompt, generationGuide(input)].filter(
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
    const preSaveSpriteExpressions = spriteExpressionsFromAgentResults(preSaveAgentResults);
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
    if (saved) yield { type: savedGenerationEventType(input), data: saved };
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
    const spriteExpressions = spriteExpressionsFromAgentResults(allAgentResults);
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
        yield { type: savedGenerationEventType(input), data: patched };
      }
    }

    const hasIllustrationRequest = emittedAgentResults.some((result) => illustratorPromptData(result) !== null);
    if (saved && hasIllustrationRequest) {
      yield { type: "phase", data: "Generating illustration..." };
      const illustration = await generateIllustrationAttachments({
        deps,
        chat,
        results: emittedAgentResults,
        imagePromptSettings: input.imagePromptSettings,
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
        yield { type: savedGenerationEventType(input), data: patched };
      }
    }
    throwIfAborted(signal);
    if (saved && input.impersonate !== true) {
      await persistTrackerSnapshotSafely(deps.storage, chatId, latestSaved, allAgentResults, generationTrackerBaseline);
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
  if (saved) yield { type: savedGenerationEventType(input), data: saved };
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
  yield { type: "done" };
}

function generationGuide(input: StartGenerationInput): LlmMessage | null {
  const guide = readString(input.generationGuide).trim();
  return guide ? { role: "user", content: guide } : null;
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
      if (chunk.type === "token" && chunk.text) {
        yield* emitInlineParts(chunk.text);
      } else if (chunk.type === "thinking" && chunk.text) {
        thinking += chunk.text;
        yield { type: "thinking", data: chunk.text };
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
