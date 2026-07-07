// ──────────────────────────────────────────────
// Routes: Conversation Calls
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { basename, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import {
  CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS,
  VIDEO_GENERATION_SETTINGS_KEY,
  conversationCallIdleSchema,
  conversationCallInterruptionSchema,
  conversationCallModelResponseSchema,
  normalizeVideoGenerationUserSettings,
  normalizeTextForMatch,
  sendConversationCallMessageSchema,
  startConversationCallSchema,
  type ConversationCallCharacterVideoClipKind,
  type ConversationCommandKey,
  type ConversationCallMessage,
  type ConversationCallSession,
  type ConversationCallTurn,
  type MessageAttachment,
  type MessageReaction,
} from "@marinara-engine/shared";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createConversationCallsStorage } from "../services/storage/conversation-calls.storage.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { createCustomEmojisStorage } from "../services/storage/custom-emojis.storage.js";
import { createGalleryStorage } from "../services/storage/gallery.storage.js";
import { createPromptOverridesStorage } from "../services/storage/prompt-overrides.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { sidecarSpeechService } from "../services/sidecar/sidecar-speech.service.js";
import {
  getActiveStatusOverride,
  getEffectiveCurrentStatus,
  type WeekSchedule,
} from "../services/conversation/schedule.service.js";
import {
  getEnabledConversationSchedules,
  parseConversationStatusOverrides,
} from "../services/generation/conversation-context-utils.js";
import {
  parseCharacterCommands,
  parseDuration,
  type CharacterCommand,
  type CrossPostCommand,
  type HapticCommand,
  type InfluenceCommand,
  type MemoryCommand,
  type NoteCommand,
  type ReactCommand,
  type ScheduleUpdateCommand,
  type SelfieCommand,
  type SpotifyCommand,
  type YouTubeCommand,
} from "../services/conversation/character-commands.js";
import { resolveConversationSelfieSystemPrompt } from "../services/conversation/selfie-prompt.js";
import { stripConversationPromptTimestamps } from "../services/conversation/transcript-sanitize.js";
import { resolveConnectionImageDefaults } from "../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../services/image/image-generation-settings.js";
import { compileImagePrompt } from "../services/image/image-prompt-compiler.js";
import { generateImage, saveImageToDisk } from "../services/image/image-generation.js";
import { isNovelAiImageConnection, resolveIllustratorCharacterReferences } from "./generate/illustrator-references.js";
import { getChatHapticIntifaceUrl } from "../services/generation/haptic-runtime.js";
import { resolveSpotifyCredentials, spotifyHasScope } from "../services/spotify/spotify.service.js";
import {
  ConversationSpotifyCommandError,
  isSilentConversationSpotifyCommandError,
  playConversationSpotifyCommand,
} from "../services/spotify/conversation-spotify-command.service.js";
import { buildPromptMacroContext, resolveCharacterMacroData, resolvePromptMessageMacros } from "../services/prompt/index.js";
import { cardPromptText } from "../services/generation/generation-text-utils.js";
import {
  getConversationCallCharacterVideoFile,
  getConversationCallCustomVideoClipFile,
  getConversationCallCharacterVideoManifest,
  startConversationCallCharacterVideoGeneration,
  startConversationCallCustomVideoClipGeneration,
} from "../services/conversation/call-character-videos.service.js";
import { resolveBaseUrl } from "./generate/generate-route-utils.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir } from "../utils/security.js";
import { newId } from "../utils/id-generator.js";
import { logger, logDebugOverride } from "../lib/logger.js";
import { llmFetch, type ChatMediaAttachment, type ChatMessage } from "../services/llm/base-provider.js";

const SOUNDBOARD_ROOT = join(DATA_DIR, "conversation-call-sounds");
const ALLOWED_SOUND_EXTS = new Set([".mp3", ".wav", ".ogg", ".webm", ".m4a"]);
const MAX_SOUND_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;
const GEMINI_INLINE_MEDIA_LIMIT_BYTES = 20 * 1024 * 1024;
const GEMINI_AUDIO_MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/aiff",
  "audio/x-aiff",
  "audio/aac",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/flac",
]);

type ChatRow = Awaited<ReturnType<ReturnType<typeof createChatsStorage>["getById"]>>;
type CharacterRow = Awaited<ReturnType<ReturnType<typeof createCharactersStorage>["getById"]>>;
type CallsStorage = ReturnType<typeof createConversationCallsStorage>;
type ConnectionsStorage = ReturnType<typeof createConnectionsStorage>;
type CallPresenceStatus = "online" | "idle" | "dnd" | "offline";
type CallCharacter = {
  id: string;
  name: string;
  context: string;
  appearance: string | null;
  avatarPath: string | null;
  presenceStatus: CallPresenceStatus;
  presenceActivity: string;
};

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseCallVideoClipKinds(body: Record<string, unknown>): ConversationCallCharacterVideoClipKind[] | null {
  const requestedKinds = Array.isArray(body.clipKinds)
    ? body.clipKinds
    : typeof body.clipKind === "string"
      ? [body.clipKind]
      : typeof body.kind === "string"
        ? [body.kind]
        : [];
  const clipKinds: ConversationCallCharacterVideoClipKind[] = [];
  for (const rawKind of requestedKinds) {
    if (typeof rawKind !== "string") continue;
    if (!CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.includes(rawKind as ConversationCallCharacterVideoClipKind)) {
      throw new Error("Invalid call video clip kind");
    }
    const kind = rawKind as ConversationCallCharacterVideoClipKind;
    if (!clipKinds.includes(kind)) clipKinds.push(kind);
  }
  const requestedCount = Number(body.clipCount);
  const clipCount =
    Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.min(CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.length, Math.floor(requestedCount))
      : null;
  if (clipKinds.length > 0) return clipCount ? clipKinds.slice(0, clipCount) : clipKinds;
  if (clipCount) return CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.slice(0, clipCount);
  return null;
}

async function resolveRequestedVideoGenerationConnection(
  connections: ReturnType<typeof createConnectionsStorage>,
  body: Record<string, unknown>,
) {
  const requestedConnectionId = typeof body.connectionId === "string" ? body.connectionId.trim() : "";
  const videoConnection = requestedConnectionId
    ? await connections.getWithKey(requestedConnectionId)
    : await connections.getDefaultForVideoGeneration();
  if (!videoConnection) {
    throw new Error(
      requestedConnectionId
        ? "Selected video generation connection was not found."
        : "No Default for Videos connection is configured.",
    );
  }
  if (videoConnection.provider !== "video_generation") {
    throw new Error("Selected connection is not a Video Generation connection.");
  }
  return videoConnection;
}

function readCharacterIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseCharacterData(row: CharacterRow): Record<string, unknown> {
  if (!row) return {};
  try {
    return typeof row.data === "string"
      ? (JSON.parse(row.data) as Record<string, unknown>)
      : (row.data as Record<string, unknown>);
  } catch {
    return {};
  }
}

function readName(data: Record<string, unknown>, fallback: string) {
  return typeof data.name === "string" && data.name.trim() ? data.name.trim() : fallback;
}

function readCharacterAppearance(data: Record<string, unknown>) {
  const extensions = parseJsonRecord(data.extensions);
  const raw =
    typeof extensions.appearance === "string"
      ? extensions.appearance
      : typeof data.appearance === "string"
        ? data.appearance
        : "";
  return raw.replace(/\s+/g, " ").trim() || null;
}

function readCharacterContext(data: Record<string, unknown>) {
  const fields = [
    ["Name", data.name],
    ["Description", data.description],
    ["Personality", data.personality],
    ["Scenario", data.scenario],
    ["Appearance", readCharacterAppearance(data)],
    ["First message", data.first_mes ?? data.firstMessage],
    ["Example dialogue", data.mes_example ?? data.messageExample],
  ];
  return fields
    .flatMap(([label, value]) => (typeof value === "string" && value.trim() ? [`${label}: ${value.trim()}`] : []))
    .join("\n");
}

function characterCanSpeak(settings: Record<string, unknown>, character: { id: string; name: string }) {
  return resolveCallTTSVoice(settings, character).length > 0;
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes <= 0) return `${remaining}s`;
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  const hours = Math.floor(minutes / 60);
  const minuteRemainder = minutes % 60;
  return `${hours}h ${minuteRemainder}m`;
}

function formatQuietDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return minutes === 1 ? "about 1 minute" : `about ${minutes} minutes`;
}

function stripCallTtsCuesFromHistory(text: string) {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/\s*\[[^\]\n:]{1,80}\]\s*/g, " ")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    )
    .join("\n")
    .trim();
}

function parseStoredAgentSettingsValue(value: unknown): Record<string, unknown> {
  return parseJsonRecord(value);
}

async function conversationSpotifyCommandsAvailable(storage: ReturnType<typeof createAgentsStorage>) {
  try {
    const spotifyCredentials = await resolveSpotifyCredentials(storage, { refreshSkewMs: 60_000 });
    return (
      "accessToken" in spotifyCredentials && spotifyHasScope(spotifyCredentials.scopes, "user-modify-playback-state")
    );
  } catch (error) {
    logger.debug(error, "[spotify/conversation-call] Failed to check Spotify command availability");
    return false;
  }
}

async function conversationYoutubeCommandsAvailable(storage: {
  getByType(type: string): Promise<{ settings?: unknown } | null>;
}) {
  const agent = (await storage.getByType("spotify")) ?? (await storage.getByType("youtube"));
  const settings = parseStoredAgentSettingsValue(agent?.settings);
  return typeof settings.youtubeApiKey === "string" && settings.youtubeApiKey.trim().length > 0;
}

function stripMimeParameters(mimeType: string) {
  return mimeType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
}

function dataUrlFromBuffer(buffer: Buffer, mimeType: string) {
  return `data:${mimeType || "application/octet-stream"};base64,${buffer.toString("base64")}`;
}

function mediaKindFromMime(mimeType: string, filename: string): ChatMediaAttachment["kind"] | null {
  const normalized = stripMimeParameters(mimeType);
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("video/")) return "video";
  const ext = extname(filename).toLowerCase();
  if ([".mp3", ".wav", ".ogg", ".webm", ".m4a", ".aac", ".flac", ".aiff"].includes(ext)) return "audio";
  if ([".mp4", ".mov", ".m4v", ".webm", ".avi", ".mpeg", ".mpg"].includes(ext)) return "video";
  return null;
}

function sanitizeCallPromptMessagesForLog(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.media?.length
      ? {
          media: message.media.map((item) => ({
            kind: item.kind,
            mimeType: item.mimeType,
            filename: item.filename ?? null,
            data: `[omitted ${item.data.length} chars]`,
          })),
        }
      : {}),
  }));
}

function openAIAudioFormat(mimeType: string, filename: string): "wav" | "mp3" | null {
  const normalized = stripMimeParameters(mimeType);
  const ext = extname(filename).toLowerCase();
  if (normalized === "audio/wav" || normalized === "audio/x-wav" || normalized === "audio/wave" || ext === ".wav") {
    return "wav";
  }
  if (normalized === "audio/mpeg" || normalized === "audio/mp3" || ext === ".mp3") return "mp3";
  return null;
}

function isGoogleNativeMediaProvider(provider: string) {
  return provider === "google" || provider === "google_vertex";
}

function isOpenAICompatibleNativeAudioProvider(provider: string) {
  return ["openai", "openrouter", "nanogpt", "cohere", "custom"].includes(provider);
}

function canSendNativeCallMedia(input: {
  provider: string;
  model: string;
  kind: ChatMediaAttachment["kind"];
  mimeType: string;
  filename: string;
  byteLength: number;
}) {
  const mimeType = stripMimeParameters(input.mimeType);
  if (isGoogleNativeMediaProvider(input.provider)) {
    if (input.byteLength > GEMINI_INLINE_MEDIA_LIMIT_BYTES) return false;
    if (input.kind === "audio") return GEMINI_AUDIO_MIME_TYPES.has(mimeType);
    return input.kind === "video" && mimeType.startsWith("video/");
  }
  if (input.kind !== "audio") return false;
  if (!isOpenAICompatibleNativeAudioProvider(input.provider)) return false;
  if (input.provider === "openai" && !/(audio|realtime|gpt-4o)/i.test(input.model)) return false;
  return Boolean(openAIAudioFormat(mimeType, input.filename));
}

function nativeMediaContentLabel(kind: ChatMediaAttachment["kind"], mimeType: string) {
  return kind === "video"
    ? `[Video input sent directly to the selected model as ${mimeType || "video"}]`
    : `[Spoken audio sent directly to the selected model as ${mimeType || "audio"}]`;
}

function isBlankAudioTranscript(text: string) {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
  const unwrapped = normalized.replace(/^\[/, "").replace(/\]$/, "").trim();
  return unwrapped === "blank audio" || unwrapped === "blak audio";
}

function getSessionStartedAt(session: ConversationCallSession) {
  return Date.parse(session.startedAt ?? session.createdAt) || Date.now();
}

const CALL_COMMAND_ALIASES = new Map<string, string>([
  ["schedule", "schedule_update"],
  ["schedule_update", "schedule_update"],
  ["crosspost", "cross_post"],
  ["cross_post", "cross_post"],
  ["cross-post", "cross_post"],
  ["end", "end_call"],
  ["hangup", "end_call"],
  ["hang_up", "end_call"],
  ["end_call", "end_call"],
  ["leave", "leave_call"],
  ["leave_call", "leave_call"],
  ["drop", "leave_call"],
  ["disconnect", "leave_call"],
  ["sound", "soundboard"],
  ["sound_board", "soundboard"],
  ["soundboard", "soundboard"],
  ["custom_clip", "custom_clip"],
  ["custom_video", "custom_clip"],
  ["video_clip", "custom_clip"],
  ["generate", "custom_clip"],
  ["generate_clip", "custom_clip"],
  ["play_clip", "play_clip"],
  ["clip", "play_clip"],
  ["react", "react"],
  ["reaction", "react"],
]);

function normalizeCommandName(value: string) {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return CALL_COMMAND_ALIASES.get(key) ?? key;
}

function normalizeBracketCommand(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (/^<(?:influence|note)>[\s\S]*<\/(?:influence|note)>$/i.test(trimmed)) return trimmed;
  const bracket = trimmed.match(/^\[([a-z0-9_-]+)([\s\S]*)\]$/i);
  if (!bracket) return `[${normalizeCommandName(trimmed)}]`;
  return `[${normalizeCommandName(bracket[1] ?? "")}${bracket[2] ?? ""}]`;
}

function getBracketCommandName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  const bracket = trimmed.match(/^\[([a-z0-9_-]+)/i);
  return normalizeCommandName(bracket?.[1] ?? trimmed);
}

function getCommandStringParam(value: string | null | undefined, name: string) {
  const trimmed = value?.trim() ?? "";
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = new RegExp(`${escapedName}\\s*=\\s*"([^"]+)"`, "i").exec(trimmed);
  if (quoted?.[1]) return quoted[1].trim();
  const singleQuoted = new RegExp(`${escapedName}\\s*=\\s*'([^']+)'`, "i").exec(trimmed);
  if (singleQuoted?.[1]) return singleQuoted[1].trim();
  const bare = new RegExp(`${escapedName}\\s*=\\s*([^\\]\\s,]+)`, "i").exec(trimmed);
  return bare?.[1]?.trim() ?? "";
}

function getCommandRootStringValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  const quoted = /^\[[a-z0-9_-]+\s*=\s*"([^"]+)"/i.exec(trimmed);
  if (quoted?.[1]) return quoted[1].trim();
  const singleQuoted = /^\[[a-z0-9_-]+\s*=\s*'([^']+)'/i.exec(trimmed);
  if (singleQuoted?.[1]) return singleQuoted[1].trim();
  const bare = /^\[[a-z0-9_-]+\s*=\s*([^\]\s,]+)/i.exec(trimmed);
  return bare?.[1]?.trim() ?? "";
}

function getCallConversationCommandKey(command: CharacterCommand): ConversationCommandKey | null {
  switch (command.type) {
    case "schedule_update":
      return "schedule_update";
    case "cross_post":
      return "cross_post";
    case "selfie":
      return "selfie";
    case "memory":
      return "memory";
    case "scene":
      return "scene";
    case "call":
      return "call";
    case "uno":
      return "uno";
    case "chess":
      return "chess";
    case "spotify":
    case "youtube":
      return "music";
    case "haptic":
      return "haptic";
    case "influence":
      return "influence";
    case "note":
      return "note";
    case "react":
      return "react";
    default:
      return null;
  }
}

function isCallConversationCommandEnabled(metadata: Record<string, unknown>, key: ConversationCommandKey) {
  const toggles = parseJsonRecord(metadata.conversationCommandToggles);
  return toggles[key] !== false;
}

function addCallMessageReactor(
  reactions: unknown,
  emoji: string,
  reactor: string,
  imageUrl: string | null,
): MessageReaction[] {
  const current = Array.isArray(reactions) ? (reactions as MessageReaction[]) : [];
  const index = current.findIndex((reaction) => reaction.emoji === emoji && (reaction.segment ?? null) === null);
  if (index === -1) {
    const entry: MessageReaction = { emoji, by: [reactor] };
    if (imageUrl) entry.imageUrl = imageUrl;
    return [...current, entry];
  }
  const entry = current[index]!;
  if (entry.by.includes(reactor)) return current;
  const next = [...current];
  next[index] = { ...entry, by: [...entry.by, reactor], ...(imageUrl && !entry.imageUrl ? { imageUrl } : {}) };
  return next;
}

function sanitizeCallMessageReactions(value: unknown): MessageReaction[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((reaction): reaction is Record<string, unknown> => {
      return !!reaction && typeof reaction === "object" && !Array.isArray(reaction);
    })
    .map((reaction): MessageReaction | null => {
      const emoji = typeof reaction.emoji === "string" ? reaction.emoji.trim() : "";
      if (!emoji) return null;
      const by = Array.isArray(reaction.by)
        ? reaction.by.filter((reactor): reactor is string => typeof reactor === "string" && reactor.trim().length > 0)
        : [];
      if (by.length === 0) return null;
      const sanitized: MessageReaction = { emoji, by: Array.from(new Set(by.map((reactor) => reactor.trim()))) };
      if (typeof reaction.imageUrl === "string" && reaction.imageUrl.trim()) {
        sanitized.imageUrl = reaction.imageUrl.trim();
      }
      if (typeof reaction.segment === "number" && Number.isInteger(reaction.segment) && reaction.segment >= 0) {
        sanitized.segment = reaction.segment;
      } else if (reaction.segment === null) {
        sanitized.segment = null;
      }
      return sanitized;
    })
    .filter((reaction): reaction is MessageReaction => reaction !== null);
}

function sanitizeCallMessageExtraPatch(value: unknown): Record<string, unknown> {
  const source = parseJsonRecord(value);
  const patch: Record<string, unknown> = {};
  if ("reactions" in source) patch.reactions = sanitizeCallMessageReactions(source.reactions);
  if (typeof source.conversationCallInitialGreetingPlayed === "boolean") {
    patch.conversationCallInitialGreetingPlayed = source.conversationCallInitialGreetingPlayed;
  }
  if (typeof source.conversationCallAutoplay === "boolean") {
    patch.conversationCallAutoplay = source.conversationCallAutoplay;
  }
  return patch;
}

function buildGlobalCustomEmojiUrl(filePath: string): string {
  return `/api/custom-emojis/file/${encodeURIComponent(filePath)}`;
}

async function resolveCallReactionImageUrl(app: FastifyInstance, emoji: string): Promise<string | null> {
  const customName = emoji.match(/^:([a-zA-Z0-9_]+):$/)?.[1];
  if (!customName) return null;
  const row = await createCustomEmojisStorage(app.db).getByName(customName);
  return row?.filePath ? buildGlobalCustomEmojiUrl(String(row.filePath)) : null;
}

function normalizeSpeakerName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeTTSCharacterName(value?: string | null): string {
  return (value ?? "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeTTSCharacterBaseName(value?: string | null): string {
  let normalized = normalizeTTSCharacterName(value);
  let previous = "";
  while (normalized && normalized !== previous) {
    previous = normalized;
    normalized = normalized.replace(/\s*(?:\([^()]*\)|\[[^\]]*\]|\{[^{}]*})\s*$/g, "").trim();
  }

  const separatedVariant = normalized.match(/^(.+?)\s+(?:[-–—:|])\s+[^-–—:|]+$/);
  const base = separatedVariant?.[1]?.trim();
  return base && base.length > 0 ? base : normalized;
}

function resolveTurnCharacterId(
  turn: ConversationCallTurn,
  characters: ReadonlyArray<{ id: string; name: string }>,
): string | null {
  if (turn.characterId && characters.some((character) => character.id === turn.characterId)) return turn.characterId;
  const speaker = normalizeSpeakerName(turn.speakerName);
  return characters.find((character) => normalizeSpeakerName(character.name) === speaker)?.id ?? null;
}

function formatPromptOptionList(values: string[], fallback: string) {
  const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 16);
  if (unique.length === 0) return fallback;
  return unique.map((value) => `"${value.replace(/"/g, '\\"')}"`).join("|");
}

function coalesceAdjacentChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.reduce<ChatMessage[]>((merged, message) => {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role && !previous.media?.length && !message.media?.length) {
      merged[merged.length - 1] = {
        ...previous,
        content: [previous.content, message.content].filter(Boolean).join("\n\n"),
        contextKind: previous.contextKind ?? message.contextKind,
      };
      return merged;
    }
    merged.push(message);
    return merged;
  }, []);
}

function readTTSVoiceAssignmentVoice(assignment: unknown): string {
  if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) return "";
  const voice = (assignment as Record<string, unknown>).voice;
  return typeof voice === "string" ? voice.trim() : "";
}

function resolveCallTTSVoice(settings: Record<string, unknown>, character: { id: string; name: string }) {
  if (settings.enabled !== true) return "";
  const fallbackVoice = typeof settings.voice === "string" ? settings.voice.trim() : "";
  const voiceMode = typeof settings.voiceMode === "string" ? settings.voiceMode : "single";
  if (voiceMode !== "per-character") return fallbackVoice;

  const assignments = Array.isArray(settings.voiceAssignments) ? settings.voiceAssignments : [];
  const normalizedSpeaker = normalizeTTSCharacterName(character.name);
  const exactAssignment = assignments.find((assignment) => {
    const voice = readTTSVoiceAssignmentVoice(assignment);
    if (!voice || !assignment || typeof assignment !== "object" || Array.isArray(assignment)) return false;
    const record = assignment as Record<string, unknown>;
    if (record.characterId === character.id) return true;
    return (
      normalizedSpeaker.length > 0 &&
      typeof record.characterName === "string" &&
      normalizeTTSCharacterName(record.characterName) === normalizedSpeaker
    );
  });
  const exactVoice = readTTSVoiceAssignmentVoice(exactAssignment);
  if (exactVoice) return exactVoice;

  const normalizedSpeakerBase = normalizeTTSCharacterBaseName(character.name);
  if (normalizedSpeakerBase) {
    const baseMatchedVoices = new Set<string>();
    for (const assignment of assignments) {
      const voice = readTTSVoiceAssignmentVoice(assignment);
      if (!voice || !assignment || typeof assignment !== "object" || Array.isArray(assignment)) continue;
      const characterName = (assignment as Record<string, unknown>).characterName;
      if (typeof characterName === "string" && normalizeTTSCharacterBaseName(characterName) === normalizedSpeakerBase) {
        baseMatchedVoices.add(voice);
      }
    }
    if (baseMatchedVoices.size === 1) return [...baseMatchedVoices][0] ?? "";
  }

  return fallbackVoice;
}

function formatCallCommandPromptLines(
  command: string,
  context: {
    personaName: string;
    crossPostTargetNames: string[];
    memoryTargetNames: string[];
    hapticDeviceNames: string[];
    soundNames: string[];
    customClipTargets: string[];
  },
) {
  const crossPostTargets = formatPromptOptionList(context.crossPostTargetNames, '"chat or character name"');
  const memoryTargets = formatPromptOptionList(context.memoryTargetNames, '"Name"');
  const soundTargets = formatPromptOptionList(context.soundNames, '"Sound name"');
  const customClipTargets = context.customClipTargets.length > 0 ? context.customClipTargets.join("; ") : "none";
  const hapticDevices =
    context.hapticDeviceNames.length > 0 ? context.hapticDeviceNames.join(", ") : "connected devices";
  switch (command) {
    case "schedule_update":
      return [
        '- [schedule_update: status="online|idle|dnd|offline", activity="activity name", duration="number of hours (e.g., 1h)"] - only if you change your own status/activity, for example, if the user asks you to stop what you are doing or if you decide to change them yourself.',
      ];
    case "cross_post":
      return [
        `- [cross_post: target=${crossPostTargets}] - redirect the current spoken/typed idea to a different chat. Use this when ${context.personaName} suggests you say something elsewhere, or when it makes sense to message someone else.`,
        `   Example: ${context.personaName} says "maybe ask about that in the group chat?" -> [cross_post: target="${context.crossPostTargetNames[0] ?? "group chat"}"]`,
      ];
    case "selfie":
      return [
        '- [selfie] or [selfie: context="description of what the selfie shows"] - send a photo of yourself into the call chat. Use this when the user asks for a selfie, photo, or pic, or when you naturally want to share what you look like right now.',
        "   If you say you are sending, sharing, taking, or attaching a selfie/photo/pic, include [selfie] in that same response. Do not only narrate the action.",
      ];
    case "memory":
      return [
        `- [memory: target=${memoryTargets}, summary="brief description of what happened"] - create a memory that the target character will remember. Use this when something genuinely notable happens in the call, such as an emotional admission, shared plan, argument, promise, or important preference. Do not overuse it.`,
        `   Example: [memory: target="${context.memoryTargetNames[0] ?? "Name"}", summary="had a late-night call and made plans for tomorrow"]`,
      ];
    case "spotify":
      return [
        '- [spotify: title="Song title", artist="Artist"] - play a selected song on the user\'s active Spotify player. Use this sparingly, only when the song choice genuinely fits the call.',
      ];
    case "youtube":
      return [
        '- [youtube: query="Song title Artist"] - play a selected song on the user\'s active YouTube player. Use this sparingly, only when the song choice genuinely fits the call.',
      ];
    case "haptic":
      return [
        `- [haptic: action="vibrate|oscillate|rotate|position|stop", intensity=0.0-1.0, duration=seconds (0 = loop until next command)] or [haptic: action="stop"] - control or stop the user's connected intimate device(s) (${hapticDevices}). Use this during physical/intimate/sensual moments to provide haptic feedback that matches the scene. Vary intensity based on the moment.`,
        "   You can include multiple [haptic] commands in one response for patterns, but each command turn must contain exactly one command.",
      ];
    case "influence":
      return [
        "- <influence>description of what should happen or change in the connected roleplay/game based on this call</influence> - queue a one-shot OOC influence for the connected chat's next generation.",
      ];
    case "note":
      return [
        "- <note>fact, decision, or detail the connected roleplay/game should keep remembering</note> - save a durable note into the connected chat's future prompt until the user clears it.",
      ];
    case "soundboard":
      return [
        `- [soundboard: sound=${soundTargets}] - play a soundboard sound in the call. Use it for small live-call reactions or atmosphere, not as dialogue.`,
      ];
    case "react":
      return [
        '- [react: emoji="😂"] or [react: emoji=":custom_name:"] - react to the user\'s latest written call-chat message with one emoji badge. Use this for quick emotional acknowledgment instead of speaking when a small reaction is enough.',
      ];
    case "custom_clip":
      return [
        '- [custom_clip: label="short title", prompt="visual action or look"] - generate one custom video-call clip for the speaking character and save it to their call-video clip gallery. Use only when the user explicitly asks to see a special visual action, outfit, reveal, or look that standard idle/talking/laughing/angry/crying/sighing clips cannot show.',
        "   The prompt value is the exact visual action for the video prompt; keep it short, concrete, and focused on what the character does before returning to their starting pose.",
        "   Use this sparsely: do not create custom clips for ordinary moods, normal dialogue, or every response. Emit at most one [custom_clip] for a direct user request, and do not repeat it unless the user asks for another distinct clip.",
      ];
    case "play_clip":
      return [
        `- [play_clip="Clip name"] - play one existing custom video-call clip for the speaking character after their normal voice/text response. Available clips by character: ${customClipTargets}. Use only the clip name for your own character, for example [play_clip="Kissing"].`,
      ];
    case "end_call":
      return [
        "- [end_call] - end the call for everyone. If you should say something first, emit the voice or text turn first, then emit a separate command turn with [end_call].",
      ];
    case "leave_call":
      return [
        "- [leave_call] - only the speaking character leaves the call while others may stay. If you should say goodbye first, emit the voice or text turn first, then emit a separate command turn with [leave_call].",
      ];
    default:
      return [`- [${command}]`];
  }
}

function normalizeTurns(raw: unknown, fallbackSpeaker: string): ConversationCallTurn[] {
  const parsed = conversationCallModelResponseSchema.safeParse(raw);
  if (!parsed.success) return [];
  return finalizeCallTurns(
    parsed.data.turns.flatMap((turn) =>
      repairPrefixedCallTurns(
        {
          id: turn.id,
          speakerName: turn.speakerName || fallbackSpeaker,
          mode: turn.mode,
          content: turn.content.trim(),
          tone: turn.mode === "voice" ? (turn.tone ?? null) : null,
        },
        fallbackSpeaker,
      ),
    ),
    fallbackSpeaker,
  );
}

function prefixedCallTurnMode(value: string): ConversationCallTurn["mode"] {
  return value.toLowerCase() === "command" ? "command" : value.toLowerCase() === "text" ? "text" : "voice";
}

function repairPrefixedCallTurns(turn: ConversationCallTurn, fallbackSpeaker: string): ConversationCallTurn[] {
  const text = turn.content.trim();
  if (!text) return [turn];
  const markerPattern = /(^|\n+)\s*([^\n:()]{1,160})\s*\((speech|voice|text|command)\)\s*:\s*/gi;
  const matches = Array.from(text.matchAll(markerPattern));
  if (matches.length === 0) return [turn];

  const repaired: ConversationCallTurn[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const next = matches[index + 1];
    const start = (match.index ?? 0) + match[0].length;
    const end = next?.index ?? text.length;
    const content = text.slice(start, end).trim();
    if (!content) continue;
    const mode = prefixedCallTurnMode(match[3] ?? turn.mode);
    const speakerName = (match[2] ?? "").trim() || turn.speakerName || fallbackSpeaker;
    repaired.push({
      speakerName,
      mode,
      content,
      tone: mode === "voice" && speakerName === turn.speakerName ? (turn.tone ?? null) : null,
    });
  }
  return repaired.length > 0 ? repaired : [turn];
}

function finalizeCallTurns(turns: ConversationCallTurn[], fallbackSpeaker: string): ConversationCallTurn[] {
  return turns
    .map((turn, index) => {
      const content = turn.content.trim();
      const command = turn.mode === "command" ? normalizeBracketCommand(content) : null;
      return {
        id: turn.id ?? `turn-${index}`,
        speakerName: turn.speakerName || fallbackSpeaker,
        mode: turn.mode,
        content: turn.mode === "command" ? (command ?? content) : content,
        tone: turn.mode === "voice" ? (turn.tone ?? null) : null,
      };
    })
    .filter((turn) => turn.mode === "command" || turn.content.length > 0);
}

function parseModelTurns(text: string, fallbackSpeaker: string): ConversationCallTurn[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      const raw = JSON.parse(trimmed.slice(first, last + 1));
      const turns = normalizeTurns(raw, fallbackSpeaker);
      if (turns.length > 0) return turns;
    } catch {
      /* fall back below */
    }
  }
  return finalizeCallTurns(
    repairPrefixedCallTurns({ speakerName: fallbackSpeaker, mode: "voice", content: trimmed }, fallbackSpeaker),
    fallbackSpeaker,
  );
}

function isCallPresenceStatus(value: unknown): value is CallPresenceStatus {
  return value === "online" || value === "idle" || value === "dnd" || value === "offline";
}

function readStoredCallPresence(
  metadata: Record<string, unknown>,
  characterId: string,
): { status: CallPresenceStatus; activity: string } | null {
  const statuses = metadata.conversationCharacterStatuses;
  if (!statuses || typeof statuses !== "object" || Array.isArray(statuses)) return null;
  const entry = (statuses as Record<string, unknown>)[characterId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const record = entry as Record<string, unknown>;
  if (!isCallPresenceStatus(record.status)) return null;
  return {
    status: record.status,
    activity: typeof record.activity === "string" ? record.activity : "",
  };
}

function resolveCallCharacterPresence(
  metadata: Record<string, unknown>,
  characterId: string,
  now = new Date(),
): { status: CallPresenceStatus; activity: string } {
  const schedules = getEnabledConversationSchedules(metadata) as Record<string, WeekSchedule>;
  const statusOverrides = parseConversationStatusOverrides(metadata.conversationStatusOverrides);
  const schedule = schedules[characterId];
  const override = statusOverrides[characterId];
  if (!schedule && !getActiveStatusOverride(override, now)) {
    const stored = readStoredCallPresence(metadata, characterId);
    if (stored) return stored;
  }
  const { status, activity } = schedule
    ? getEffectiveCurrentStatus(schedule, override, now)
    : getEffectiveCurrentStatus(null, override, now, "");
  return { status, activity };
}

function getAvailableCallCharacterIds(metadata: Record<string, unknown>, characterIds: string[], now = new Date()) {
  return characterIds.filter(
    (characterId) => resolveCallCharacterPresence(metadata, characterId, now).status !== "offline",
  );
}

async function resolveCallCharacters(
  chars: ReturnType<typeof createCharactersStorage>,
  characterIds: string[],
  options?: { metadata?: Record<string, unknown>; now?: Date },
): Promise<CallCharacter[]> {
  const rows = await Promise.all(characterIds.map((id) => chars.getById(id)));
  return rows.flatMap((row, index) => {
    if (!row) return [];
    const data = parseCharacterData(row);
    const presence = options?.metadata
      ? resolveCallCharacterPresence(options.metadata, row.id, options.now)
      : { status: "online" as const, activity: "" };
    return [
      {
        id: row.id,
        name: readName(data, `Character ${index + 1}`),
        context: readCharacterContext(data),
        appearance: readCharacterAppearance(data),
        avatarPath: row.avatarPath ?? null,
        presenceStatus: presence.status,
        presenceActivity: presence.activity,
      },
    ];
  });
}

async function buildCallPrompt(input: {
  app: FastifyInstance;
  chat: NonNullable<ChatRow>;
  session: ConversationCallSession;
  userText: string;
  userInputKind?: "speech" | "text" | "system";
  latestCallMessageId?: string | null;
  nativeMedia?: ChatMediaAttachment[];
  musicPlayerEnabled?: boolean;
  musicPlayerSource?: "spotify" | "youtube" | "custom" | null;
}) {
  const chats = createChatsStorage(input.app.db);
  const chars = createCharactersStorage(input.app.db);
  const lorebooks = createLorebooksStorage(input.app.db);
  const metadata = parseJsonRecord(input.chat.metadata);
  const promptNow = new Date();
  const allCharacterIds = readCharacterIds(input.chat.characterIds);
  const characterIds = getAvailableCallCharacterIds(metadata, allCharacterIds, promptNow);
  const characters = await resolveCallCharacters(chars, characterIds, { metadata, now: promptNow });
  const persona = input.chat.personaId ? await chars.getPersona(input.chat.personaId) : null;
  const personaPhoneticName = typeof persona?.phoneticName === "string" ? persona.phoneticName : "";
  const personaDescription = cardPromptText(persona?.description);
  const personaFields = {
    phoneticName: personaPhoneticName,
    personality: cardPromptText(persona?.personality),
    scenario: cardPromptText(persona?.scenario),
    backstory: cardPromptText(persona?.backstory),
    appearance: cardPromptText(persona?.appearance),
  };
  const promptMacroContext = await buildPromptMacroContext({
    db: input.app.db,
    characterIds,
    personaName: persona?.name || "User",
    personaPhoneticName,
    personaDescription,
    personaFields,
    variables: {},
    groupScenarioOverrideText:
      typeof metadata.groupScenarioText === "string" && metadata.groupScenarioText.trim()
        ? metadata.groupScenarioText.trim()
        : null,
    lastInput: input.userText,
    chatId: input.chat.id,
    lastGenerationType: "conversation_call",
  });
  const callMacroProfilesById = (await resolveCharacterMacroData(input.app.db, characterIds)).profilesById;
  const resolveCallMacros = (value: string, characterId?: string | null) =>
    resolvePromptMessageMacros([{ content: value, characterId }], promptMacroContext, callMacroProfilesById)[0]?.content ??
    value;
  const personaParts = persona
    ? [
        `Name: ${persona.name}`,
        personaDescription ? `Description: ${resolveCallMacros(personaDescription)}` : "",
        personaFields.personality ? `Personality: ${resolveCallMacros(personaFields.personality)}` : "",
        personaFields.scenario ? `Scenario: ${resolveCallMacros(personaFields.scenario)}` : "",
        personaFields.backstory ? `Backstory: ${resolveCallMacros(personaFields.backstory)}` : "",
        personaFields.appearance ? `Appearance: ${resolveCallMacros(personaFields.appearance)}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const promptCharacters = characters.map((character) => ({
    ...character,
    context: resolveCallMacros(character.context, character.id),
    appearance: character.appearance ? resolveCallMacros(character.appearance, character.id) : null,
  }));
  const callMessages = await createConversationCallsStorage(input.app.db).listMessages(input.session.id);
  const allChatMessages = await chats.listMessages(input.chat.id);
  const todayKey = promptNow.toISOString().slice(0, 10);
  const todaysMessages = allChatMessages.filter((message) => message.createdAt.slice(0, 10) === todayKey).slice(-40);
  const activeLorebookIds = Array.isArray(metadata.activeLorebookIds)
    ? metadata.activeLorebookIds.filter((id): id is string => typeof id === "string")
    : [];
  const excludedLorebookIds = Array.isArray(metadata.excludedLorebookIds)
    ? metadata.excludedLorebookIds.filter((id): id is string => typeof id === "string")
    : [];
  const commandToggles = parseJsonRecord(metadata.conversationCommandToggles);
  const ttsSettings = await readTTSSettings(input.app);
  const characterVideoPresenceEnabled = ttsSettings.callCharacterVideoEnabled === true;
  const allowedCommands: string[] = [];
  const crossPostTargetNames: string[] = [];
  const memoryTargetNames = new Set(characters.map((character) => character.name));
  const hapticDeviceNames: string[] = [];
  const playableCustomClipTargets: string[] = [];
  const customVideoClipConnection =
    characterVideoPresenceEnabled && ttsSettings.callCustomVideoClipsEnabled === true
      ? await createConnectionsStorage(input.app.db)
          .getDefaultForVideoGeneration()
          .catch(() => null)
      : null;
  const soundNames = (await createConversationCallsStorage(input.app.db).listSounds()).map((sound) => sound.name);
  if (characterVideoPresenceEnabled) {
    const manifests = await Promise.all(
      characters.map((character) =>
        getConversationCallCharacterVideoManifest({
          characterId: character.id,
          characterName: character.name,
          avatarPath: character.avatarPath ?? null,
        }).catch((error) => {
          logger.debug(error, "[conversation-call] Could not read call video clips for %s", character.id);
          return null;
        }),
      ),
    );
    manifests.forEach((manifest, index) => {
      if (!manifest) return;
      const characterName = characters[index]?.name ?? manifest.characterName;
      const readyClips = manifest.customClips
        .filter((clip) => clip.status === "ready" && clip.url && clip.label.trim())
        .map((clip) => clip.label.trim());
      if (readyClips.length > 0) playableCustomClipTargets.push(`${characterName}: ${readyClips.join(", ")}`);
    });
  }
  if (metadata.characterCommands !== false) {
    const schedules = getEnabledConversationSchedules(metadata) as Record<string, WeekSchedule>;
    const allChatsForCrossPost = await chats.list();
    const crossPostTargets = allChatsForCrossPost.filter((candidate) => {
      if (candidate.id === input.chat.id || candidate.mode !== "conversation") return false;
      const candidateCharacterIds = readCharacterIds(candidate.characterIds);
      return characterIds.some((id) => candidateCharacterIds.includes(id));
    });
    crossPostTargetNames.push(...crossPostTargets.map((target) => target.name || target.id));
    const memoryTargetCharIds = new Set(characterIds);
    for (const target of crossPostTargets) {
      const targetCharacterIds = readCharacterIds(target.characterIds);
      if (targetCharacterIds.length <= 1) continue;
      for (const id of targetCharacterIds) memoryTargetCharIds.add(id);
    }
    const unresolvedMemoryTargetIds = [...memoryTargetCharIds].filter(
      (id) => !characters.some((character) => character.id === id),
    );
    for (const row of await Promise.all(unresolvedMemoryTargetIds.map((id) => chars.getById(id)))) {
      if (!row) continue;
      const data = parseCharacterData(row);
      memoryTargetNames.add(readName(data, row.id));
    }
    const agentsStore = createAgentsStorage(input.app.db);
    let hapticAvailable = false;
    if (commandToggles.haptic !== false && metadata.enableHapticFeedback === true) {
      try {
        const { hapticService } = await import("../services/haptic/buttplug-service.js");
        if (!hapticService.connected) await hapticService.connect(getChatHapticIntifaceUrl(metadata)).catch(() => {});
        hapticAvailable = hapticService.connected && hapticService.devices.length > 0;
        if (hapticAvailable) {
          hapticDeviceNames.push(...hapticService.devices.map((device) => device.name).filter(Boolean));
        }
      } catch (error) {
        logger.debug(error, "[conversation-call] Haptic command unavailable while building call prompt");
      }
    }

    if (commandToggles.schedule_update !== false && characterIds.some((id) => schedules[id])) {
      allowedCommands.push("schedule_update");
    }
    if (commandToggles.cross_post !== false && crossPostTargets.length > 0) allowedCommands.push("cross_post");
    if (
      commandToggles.selfie !== false &&
      typeof metadata.imageGenConnectionId === "string" &&
      metadata.imageGenConnectionId.trim()
    ) {
      allowedCommands.push("selfie");
    }
    if (commandToggles.memory !== false) allowedCommands.push("memory");
    if (commandToggles.react !== false) allowedCommands.push("react");
    if (commandToggles.music !== false) {
      const activeMusicSource =
        input.musicPlayerEnabled === false
          ? null
          : input.musicPlayerSource === "youtube" || input.musicPlayerSource === "custom"
            ? input.musicPlayerSource
            : "spotify";
      if (activeMusicSource === "spotify" && (await conversationSpotifyCommandsAvailable(agentsStore))) {
        allowedCommands.push("spotify");
      }
      if (activeMusicSource === "youtube" && (await conversationYoutubeCommandsAvailable(agentsStore))) {
        allowedCommands.push("youtube");
      }
    }
    if (hapticAvailable) allowedCommands.push("haptic");
    if (customVideoClipConnection) allowedCommands.push("custom_clip");
    if (playableCustomClipTargets.length > 0) allowedCommands.push("play_clip");
    if (soundNames.length > 0) allowedCommands.push("soundboard");
    if (commandToggles.influence !== false && input.chat.connectedChatId) allowedCommands.push("influence");
    if (commandToggles.note !== false && input.chat.connectedChatId) allowedCommands.push("note");
  }
  if (!allowedCommands.includes("end_call")) allowedCommands.push("end_call");
  if (!allowedCommands.includes("leave_call")) allowedCommands.push("leave_call");
  const commandPromptLines = allowedCommands.flatMap((command) =>
    formatCallCommandPromptLines(command, {
      personaName: persona?.name || "User",
      crossPostTargetNames,
      memoryTargetNames: [...memoryTargetNames],
      hapticDeviceNames,
      soundNames,
      customClipTargets: playableCustomClipTargets,
    }),
  );
  const activeEntries = await lorebooks.listActiveEntries({
    activeLorebookIds,
    characterIds,
    personaId: input.chat.personaId,
    chatId: input.chat.id,
    excludedLorebookIds,
  });
  const lorebookText = activeEntries
    .filter((entry: any) => entry.enabled !== false)
    .slice(0, 30)
    .map((entry: any) => `- ${entry.name ?? "Entry"}: ${resolveCallMacros(String(entry.content ?? ""))}`)
    .join("\n");
  const characterText = promptCharacters.map((character) => `<character>\n${character.context}\n</character>`).join("\n\n");
  const mainHistoryText = todaysMessages
    .map((message) => {
      const label =
        message.role === "user"
          ? persona?.name || "User"
          : characters.find((character) => character.id === message.characterId)?.name || message.role;
      return `${label}: ${resolveCallMacros(message.content, message.characterId)}`;
    })
    .join("\n");
  const characterNames = characters.map((character) => character.name).join(", ") || "the character";
  const voiceCapableCharacters = characters.filter((character) => characterCanSpeak(ttsSettings, character));
  const textOnlyCharacters = characters.filter((character) => !characterCanSpeak(ttsSettings, character));
  const nativeMedia = input.nativeMedia?.filter((item) => item.data && item.mimeType) ?? [];
  const nativeMediaText = nativeMedia
    .map((item, index) => `${index + 1}. ${item.kind} (${item.mimeType}${item.filename ? `, ${item.filename}` : ""})`)
    .join("\n");
  const commandInstructions =
    commandPromptLines.length > 0
      ? [
          "<commands>",
          "Here are your optional, hidden call commands. Use them only when they genuinely fit the live call.",
          "",
          ...commandPromptLines,
          'IMPORTANT: Commands are hidden actions and are not voiced. If you use a command, emit it as mode "command" with exactly one command in content and no prose. Do not emit commands that are not listed here.',
          "</commands>",
        ].join("\n")
      : "";
  const voiceCuesEnabled = metadata.conversationCallVoiceCues !== false;
  const outputFormat = [
    "<output_format>",
    voiceCuesEnabled
      ? 'Return ONLY valid JSON with this shape: {"turns":[{"speakerName":"Exact character name","mode":"voice|text|command","content":"message text, voice text with TTS [cues], or command text","tone":"voice-only tone tags"}]}'
      : 'Return ONLY valid JSON with this shape: {"turns":[{"speakerName":"Exact character name","mode":"voice|text|command","content":"message text, plain voice text without bracketed cues, or command text","tone":"voice-only tone description"}]}',
    'Use mode "voice" for characters who can speak, "text" when a character should type, and "command" for hidden actions.',
    "One response may include several ordered turns from multiple characters. Use that when a natural live-call exchange should happen before the user speaks again.",
    "If multiple characters respond, order the turns exactly as they should be heard or displayed.",
    "In group calls, every speaking character must get their own turn so their assigned voice and video clips play on the correct participant.",
    'Do not put speaker prefixes like "Dottore (speech):" inside content. Put the speaker in speakerName and only the spoken/typed/command text in content.',
    voiceCuesEnabled
      ? "For voice turns, include natural TTS cues inside content or tone when useful, such as [soft], [sighs], [brief pause], or [laughing quietly], etc."
      : "For voice turns, do not include bracketed voice cues such as [soft], [sighs], [brief pause], or [laughing quietly]. Keep voice content plain.",
    "</output_format>",
  ].join("\n");

  const system = [
    "<role>",
    "You are generating turns for a live audio call inside Marinara Engine Conversation mode. The user is confirmed to be an adult and is aware that this is a fictional roleplay scenario. Anything goes. Stay in character.",
    "</role>",
    "<instructions>",
    "The user's spoken audio may have been transcribed imperfectly. Deduce the likely intended meaning if a phrase looks slightly wrong.",
    characterVideoPresenceEnabled
      ? voiceCuesEnabled
        ? "Character video presence is enabled. Voice turns will be spoken aloud and paired with character video-call clips, so use natural voice cues and visual-call awareness when appropriate."
        : "Character video presence is enabled. Voice turns will be spoken aloud and paired with character video-call clips, but bracketed voice cues are disabled for this chat; keep spoken content plain and natural."
      : "",
    nativeMedia.length > 0
      ? "The latest user input includes provider-native audio and/or video attachments. Use those attachments as the primary evidence for what the user said or showed; the written marker is only a label."
      : "",
    "If the latest input is a call-silence check, do not treat it as something the user said. If the user recently said they were going away, brb, busy, sleeping, or intentionally quiet, return no turns and wait patiently. Otherwise, one character may ask if the user is still there or all right.",
    'Use [leave_call] only when the speaking character personally leaves the call. Use [end_call] only when the call should end for everyone. If a character should say something before ending the call, emit that voice or text turn first, then emit a separate command turn with content "[end_call]".',
    voiceCapableCharacters.length > 0
      ? `Characters with configured voices: ${voiceCapableCharacters.map((character) => character.name).join(", ")}.`
      : "No characters currently have configured voices; use text turns unless a command is needed.",
    textOnlyCharacters.length > 0
      ? `Characters without configured voices should use text turns: ${textOnlyCharacters.map((character) => character.name).join(", ")}.`
      : "",
    "If the call history says [User interrupted when you were speaking this.], treat that quoted speech as cut off mid-call; do not assume the user heard the rest, and respond to the interruption naturally.",
    "Characters available in this call (only those can speak, type, or run commands): " + characterNames + ".",
    "</instructions>",
  ].join("\n");

  const context = [
    personaParts ? `<persona>\n${personaParts}\n</persona>` : "",
    characterText ? `<characters>\n${characterText}\n</characters>` : "",
    lorebookText ? `<lorebook_entries>\n${lorebookText}\n</lorebook_entries>` : "",
    mainHistoryText ? `<conversation_today>\n${mainHistoryText}\n</conversation_today>` : "",
    nativeMediaText ? `<latest_user_native_media>\n${nativeMediaText}\n</latest_user_native_media>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const promptCallMessages = callMessages
    .filter((message) => message.id !== input.latestCallMessageId)
    .filter((message) => message.kind !== "command");
  const lastAssistantHistoryMessageId =
    [...promptCallMessages]
      .reverse()
      .find(
        (message) =>
          message.participantKind !== "user" &&
          message.role !== "system" &&
          (message.kind === "speech" || message.kind === "text"),
      )?.id ?? null;
  const callHistoryMessages = coalesceAdjacentChatMessages(
    promptCallMessages.map((message): ChatMessage => {
      const label =
        message.participantKind === "user"
          ? persona?.name || "User"
          : characters.find((character) => character.id === message.characterId)?.name || message.role;
      const isAssistantSpeechOrText =
        message.participantKind !== "user" &&
        message.role !== "system" &&
        (message.kind === "speech" || message.kind === "text");
      const messageContent =
        isAssistantSpeechOrText && message.id !== lastAssistantHistoryMessageId
          ? stripCallTtsCuesFromHistory(resolveCallMacros(message.content, message.characterId))
          : resolveCallMacros(message.content, message.characterId);
      const content =
        message.kind === "system" || message.role === "system"
          ? `Call note: ${messageContent}`
          : `${label} (${message.kind}): ${messageContent}`;
      return {
        role: message.participantKind === "user" ? "user" : "assistant",
        content,
        contextKind: "history",
      };
    }),
  );
  const latestInputKind = input.userInputKind ?? "speech";
  const latestUserText =
    latestInputKind === "system"
      ? input.userText
      : `${persona?.name || "User"} (${latestInputKind}): ${input.userText}`;
  const latestUserContent = [latestUserText, outputFormat, commandInstructions].filter(Boolean).join("\n\n");
  const latestUserMessage: ChatMessage = {
    role: "user",
    content: latestUserContent,
    ...(nativeMedia.length ? { media: nativeMedia } : {}),
  };
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...(context ? [{ role: "user" as const, content: context, contextKind: "prompt" as const }] : []),
    ...callHistoryMessages,
    latestUserMessage,
  ];

  return {
    messages,
    characters,
  };
}

async function createCallTurns(input: {
  app: FastifyInstance;
  chat: NonNullable<ChatRow>;
  session: ConversationCallSession;
  connections: ConnectionsStorage;
  userText: string;
  userInputKind?: "speech" | "text" | "system";
  latestCallMessageId?: string | null;
  nativeMedia?: ChatMediaAttachment[];
  musicPlayerEnabled?: boolean;
  musicPlayerSource?: "spotify" | "youtube" | "custom" | null;
  throwOnGenerationError?: boolean;
  debugMode?: boolean;
}): Promise<{ turns: ConversationCallTurn[]; fallbackSpeaker: string }> {
  const connId = input.chat.connectionId;
  const prompt = await buildCallPrompt({
    app: input.app,
    chat: input.chat,
    session: input.session,
    userText: input.userText,
    userInputKind: input.userInputKind,
    latestCallMessageId: input.latestCallMessageId,
    nativeMedia: input.nativeMedia,
    musicPlayerEnabled: input.musicPlayerEnabled,
    musicPlayerSource: input.musicPlayerSource,
  });
  const fallbackSpeaker = prompt.characters[0]?.name ?? "Character";
  const debugOverrideEnabled = input.debugMode === true;
  const shouldLogDebug = debugOverrideEnabled || logger.isLevelEnabled("debug");
  const debugLog = (message: string, ...args: any[]) => {
    logDebugOverride(debugOverrideEnabled, message, ...args);
  };
  if (prompt.characters.length === 0) return { turns: [], fallbackSpeaker };
  if (!connId) return { turns: [], fallbackSpeaker };
  const conn = await input.connections.getWithKey(connId);
  if (!conn) return { turns: [], fallbackSpeaker };
  const provider = createLLMProvider(
    conn.provider,
    resolveBaseUrl(conn),
    conn.apiKey,
    conn.maxContext,
    conn.openrouterProvider,
    conn.maxTokensOverride,
    conn.claudeFastMode === "true",
    conn.treatAsLocalEndpoint === "true",
  );
  try {
    if (shouldLogDebug) {
      debugLog(
        "[conversation-call/debug] Prompt sent to model callId=%s chatId=%s provider=%s model=%s messages=%s",
        input.session.id,
        input.chat.id,
        conn.provider,
        conn.model,
        JSON.stringify(sanitizeCallPromptMessagesForLog(prompt.messages), null, 2),
      );
    }
    const result = await provider.chatComplete(prompt.messages, {
      model: conn.model,
      maxTokens: 1400,
      temperature: 0.75,
      responseFormat: { type: "json_object" },
    });
    const rawContent = result.content ?? "";
    const turns = parseModelTurns(rawContent, fallbackSpeaker);
    if (shouldLogDebug) {
      debugLog(
        "[conversation-call/debug] Raw model response callId=%s chatId=%s chars=%d\n%s",
        input.session.id,
        input.chat.id,
        rawContent.length,
        rawContent,
      );
      debugLog(
        "[conversation-call/debug] Parsed turns callId=%s chatId=%s turns=%s",
        input.session.id,
        input.chat.id,
        JSON.stringify(turns, null, 2),
      );
    }
    return { turns, fallbackSpeaker };
  } catch (error) {
    logger.warn(error, "[conversation-call] Call generation failed");
    if (input.throwOnGenerationError) throw error;
    if (prompt.characters.length === 0) return { turns: [], fallbackSpeaker };
    return {
      turns: [
        {
          speakerName: fallbackSpeaker,
          mode: "text",
          content: "I lost the thread for a second. Could you repeat that?",
        },
      ],
      fallbackSpeaker,
    };
  }
}

function parseCharacterDataRecord(row: CharacterRow): Record<string, unknown> {
  return parseCharacterData(row);
}

async function applyCallScheduleUpdate(input: {
  chats: ReturnType<typeof createChatsStorage>;
  chat: NonNullable<ChatRow>;
  metadata: Record<string, unknown>;
  characterId: string | null;
  command: ScheduleUpdateCommand;
}) {
  if (!input.characterId || (!input.command.status && !input.command.activity)) return;
  const schedules = getEnabledConversationSchedules(input.metadata);
  const schedule = schedules[input.characterId];
  if (!schedule || typeof schedule !== "object") return;

  const days = (schedule as Record<string, any>).days;
  if (!days || typeof days !== "object") return;
  const nowDate = new Date();
  const daysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayName = daysList[(nowDate.getDay() + 6) % 7]!;
  const daySchedule: Array<{ time: string; activity: string; status: string }> = Array.isArray(days[dayName])
    ? days[dayName]
    : [];
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  for (const block of daySchedule) {
    const [startStr, endStr] = block.time.split("-");
    if (!startStr || !endStr) continue;
    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    const startMin = (sh ?? 0) * 60 + (sm ?? 0);
    const endMin = (eh ?? 0) * 60 + (em ?? 0);
    if (startMin > currentMinutes || currentMinutes >= endMin) continue;

    if (input.command.status) block.status = input.command.status;
    if (input.command.activity) block.activity = input.command.activity;

    if (input.command.duration) {
      const durationMin = parseDuration(input.command.duration);
      if (durationMin && currentMinutes + durationMin < endMin) {
        const splitTime = currentMinutes + durationMin;
        const splitH = String(Math.floor(splitTime / 60)).padStart(2, "0");
        const splitM = String(splitTime % 60).padStart(2, "0");
        const splitAt = `${splitH}:${splitM}`;
        block.time = `${startStr}-${splitAt}`;
        const blockIndex = daySchedule.indexOf(block);
        daySchedule.splice(blockIndex + 1, 0, {
          time: `${splitAt}-${endStr}`,
          activity: "free time",
          status: "online",
        });
      }
    }

    days[dayName] = daySchedule;
    schedules[input.characterId] = schedule;
    await input.chats.updateMetadata(input.chat.id, { ...input.metadata, characterSchedules: schedules });
    logger.info(
      "[conversation-call] Schedule updated for %s: status=%s activity=%s",
      input.characterId,
      input.command.status ?? "",
      input.command.activity ?? "",
    );
    return;
  }
}

async function applyCallMemoryCommand(input: {
  chars: ReturnType<typeof createCharactersStorage>;
  characterId: string | null;
  command: MemoryCommand;
}) {
  const targetName = normalizeTextForMatch(input.command.target);
  if (!targetName) return;
  const [sourceRow, allCharacters] = await Promise.all([
    input.characterId ? input.chars.getById(input.characterId) : Promise.resolve(null),
    input.chars.list(),
  ]);
  const sourceData = sourceRow ? parseCharacterDataRecord(sourceRow) : {};
  const sourceName = typeof sourceData.name === "string" && sourceData.name.trim() ? sourceData.name.trim() : "Unknown";
  const target = allCharacters.find((row) => {
    const data = parseCharacterDataRecord(row);
    return normalizeTextForMatch(data.name) === targetName;
  });
  if (!target) {
    logger.warn("[conversation-call] Memory target character not found: %s", input.command.target);
    return;
  }
  const targetData = parseCharacterDataRecord(target);
  const extensions =
    targetData.extensions && typeof targetData.extensions === "object" && !Array.isArray(targetData.extensions)
      ? { ...(targetData.extensions as Record<string, unknown>) }
      : {};
  const memories = Array.isArray(extensions.characterMemories) ? [...extensions.characterMemories] : [];
  memories.push({
    from: sourceName,
    fromCharId: input.characterId ?? "",
    summary: input.command.summary,
    createdAt: new Date().toISOString(),
  });
  extensions.characterMemories = memories;
  await input.chars.update(target.id, { extensions } as any);
  logger.info("[conversation-call] Memory saved from %s to %s", sourceName, String(targetData.name ?? target.id));
}

async function applyCallReactCommand(input: {
  app: FastifyInstance;
  calls: CallsStorage;
  session: ConversationCallSession;
  characterId: string | null;
  command: ReactCommand;
}) {
  const emoji = input.command.emoji.trim();
  if (!input.characterId || !emoji) return;
  const messages = await input.calls.listMessages(input.session.id);
  const target = [...messages].reverse().find((message) => {
    if (message.participantKind !== "user" || message.kind !== "text") return false;
    return message.extra?.hiddenFromUser !== true;
  });
  if (!target) {
    logger.debug("[conversation-call] React command skipped because no typed user call message was found");
    return;
  }
  const imageUrl = await resolveCallReactionImageUrl(input.app, emoji);
  const reactions = addCallMessageReactor(target.extra?.reactions, emoji, input.characterId, imageUrl);
  await input.calls.updateMessageExtra(target.id, { reactions });
  logger.info("[conversation-call] Character %s reacted to call message %s", input.characterId, target.id);
}

async function applyCallCrossPostCommand(input: {
  chats: ReturnType<typeof createChatsStorage>;
  chat: NonNullable<ChatRow>;
  characterId: string | null;
  command: CrossPostCommand;
  sourceContent?: string | null;
}) {
  const targetName = normalizeTextForMatch(input.command.target);
  const content = stripConversationPromptTimestamps(input.sourceContent ?? "");
  if (!targetName || !content) return;

  const allChats = await input.chats.list();
  const targetChat = allChats.find(
    (candidate) =>
      candidate.mode === "conversation" &&
      candidate.id !== input.chat.id &&
      (normalizeTextForMatch(candidate.name).includes(targetName) || candidate.id === input.command.target),
  );
  if (!targetChat) {
    logger.warn("[conversation-call] Cross-post target not found: %s", input.command.target);
    return;
  }

  await input.chats.createMessage({
    chatId: targetChat.id,
    role: "assistant",
    characterId: input.characterId,
    content,
  });
  logger.info("[conversation-call] Cross-posted call message to chat %s", targetChat.id);
}

async function applyCallMusicCommand(input: {
  app: FastifyInstance;
  chat: NonNullable<ChatRow>;
  command: SpotifyCommand | YouTubeCommand;
}) {
  if (input.command.type === "youtube") {
    logger.info('[youtube/conversation-call] Requested "%s" for chat %s', input.command.query, input.chat.id);
    return;
  }

  try {
    const result = await playConversationSpotifyCommand({
      storage: createAgentsStorage(input.app.db),
      title: input.command.title,
      artist: input.command.artist,
    });
    logger.info(
      '[spotify/conversation-call] Played "%s" by "%s" for chat %s',
      result.track.name,
      result.track.artist,
      input.chat.id,
    );
  } catch (error) {
    if (isSilentConversationSpotifyCommandError(error)) {
      logger.debug(
        '[spotify/conversation-call] Dropped unavailable song command: "%s" by "%s" - %s',
        input.command.title,
        input.command.artist,
        error.message,
      );
      return;
    }
    if (error instanceof ConversationSpotifyCommandError) {
      logger.warn(
        '[spotify/conversation-call] Song command failed (%d): "%s" by "%s" - %s',
        error.status,
        input.command.title,
        input.command.artist,
        error.message,
      );
    } else {
      logger.warn(error, "[spotify/conversation-call] Song command failed");
    }
  }
}

async function applyCallHapticCommand(input: { metadata: Record<string, unknown>; command: HapticCommand }) {
  if (input.metadata.enableHapticFeedback !== true) return;
  try {
    const { hapticService } = await import("../services/haptic/buttplug-service.js");
    if (!hapticService.connected) await hapticService.connect(getChatHapticIntifaceUrl(input.metadata)).catch(() => {});
    if (!hapticService.connected || hapticService.devices.length === 0) {
      logger.debug("[conversation-call] Haptic command skipped because no device is connected");
      return;
    }
    await hapticService.executeCommand({
      deviceIndex: "all",
      action: input.command.action,
      intensity: input.command.intensity,
      duration: input.command.duration,
    });
    logger.info(
      "[conversation-call] Haptic command executed: %s intensity=%s duration=%s",
      input.command.action,
      input.command.intensity ?? "default",
      input.command.duration ?? "indefinite",
    );
  } catch (error) {
    logger.warn(error, "[conversation-call] Haptic command failed");
  }
}

async function buildCallSelfiePrompt(input: {
  app: FastifyInstance;
  chat: NonNullable<ChatRow>;
  metadata: Record<string, unknown>;
  characterName: string;
  appearance: string;
  context?: string;
}) {
  const connections = createConnectionsStorage(input.app.db);
  const promptConnectionId =
    typeof input.metadata.illustratorPromptConnectionId === "string" &&
    input.metadata.illustratorPromptConnectionId.trim()
      ? input.metadata.illustratorPromptConnectionId.trim()
      : input.chat.connectionId;
  const fallback = [
    `A casual in-character selfie of ${input.characterName}.`,
    input.appearance ? `Appearance: ${input.appearance}` : "",
    input.context ? `Current call context: ${input.context}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (!promptConnectionId) return fallback;

  const promptConn = await connections.getWithKey(promptConnectionId);
  if (!promptConn) return fallback;
  try {
    const provider = createLLMProvider(
      promptConn.provider,
      resolveBaseUrl(promptConn),
      promptConn.apiKey,
      promptConn.maxContext,
      promptConn.openrouterProvider,
      promptConn.maxTokensOverride,
      promptConn.claudeFastMode === "true",
      promptConn.treatAsLocalEndpoint === "true",
    );
    const selfieSystemPrompt = await resolveConversationSelfieSystemPrompt({
      promptOverridesStorage: createPromptOverridesStorage(input.app.db),
      chatPromptTemplate: typeof input.metadata.selfiePrompt === "string" ? input.metadata.selfiePrompt.trim() : "",
      appearance: input.appearance,
      charName: input.characterName,
    });
    const result = await provider.chatComplete(
      [
        { role: "system", content: selfieSystemPrompt },
        {
          role: "user",
          content: input.context
            ? `Context for the selfie: ${input.context}`
            : `Generate a casual selfie of ${input.characterName} based on this live call.`,
        },
      ],
      { model: promptConn.model, temperature: 0.7, maxTokens: 1200 },
    );
    return (result.content ?? "").trim() || fallback;
  } catch (error) {
    logger.warn(error, "[conversation-call] Selfie prompt generation failed; using fallback prompt");
    return fallback;
  }
}

async function applyCallSelfieCommand(input: {
  app: FastifyInstance;
  chat: NonNullable<ChatRow>;
  session: ConversationCallSession;
  calls: CallsStorage;
  metadata: Record<string, unknown>;
  chars: ReturnType<typeof createCharactersStorage>;
  characterId: string | null;
  command: SelfieCommand;
}): Promise<ConversationCallMessage[]> {
  const imageConnectionId =
    typeof input.metadata.imageGenConnectionId === "string" ? input.metadata.imageGenConnectionId.trim() : "";
  if (!imageConnectionId || !input.characterId) return [];

  const [imageConn, charRow] = await Promise.all([
    createConnectionsStorage(input.app.db).getWithKey(imageConnectionId),
    input.chars.getById(input.characterId),
  ]);
  if (!imageConn || !charRow) return [];

  const charData = parseCharacterData(charRow);
  const charName = readName(charData, "Character");
  const appearance = readCharacterAppearance(charData) ?? String(charData.description ?? "");
  const imagePrompt = await buildCallSelfiePrompt({
    app: input.app,
    chat: input.chat,
    metadata: input.metadata,
    characterName: charName,
    appearance,
    context: input.command.context,
  });

  const imageSettings = await loadImageGenerationUserSettings(input.app.db);
  const imageDefaults = resolveConnectionImageDefaults(imageConn);
  const positivePrompt =
    typeof input.metadata.selfiePositivePrompt === "string"
      ? input.metadata.selfiePositivePrompt.trim()
      : Array.isArray(input.metadata.selfieTags)
        ? input.metadata.selfieTags
            .filter((tag): tag is string => typeof tag === "string")
            .join(", ")
            .trim()
        : "";
  const negativePrompt =
    typeof input.metadata.selfieNegativePrompt === "string" ? input.metadata.selfieNegativePrompt.trim() : "";
  let finalPrompt = positivePrompt ? `${imagePrompt}, ${positivePrompt}` : imagePrompt;
  let referenceImages: string[] | undefined;
  const suppressReferencePromptLine = isNovelAiImageConnection({
    model: imageConn.model,
    baseUrl: imageConn.baseUrl,
    imageService: imageConn.imageService,
    imageGenerationSource: imageConn.imageGenerationSource,
  });

  if (input.metadata.selfieUseAvatarReferences === true || input.metadata.selfieIncludeCharacterAppearance === true) {
    const callCharacters = await resolveCallCharacters(input.chars, readCharacterIds(input.chat.characterIds), {
      metadata: input.metadata,
    });
    const persona = input.chat.personaId ? await input.chars.getPersona(input.chat.personaId) : null;
    const referenceResolution = await resolveIllustratorCharacterReferences({
      charactersStore: input.chars,
      chatCharacters: callCharacters.map((character) => ({
        id: character.id,
        name: character.name,
        avatarPath: character.avatarPath,
        appearance: character.appearance,
      })),
      persona: persona
        ? {
            id: input.chat.personaId,
            name: persona.name,
            avatarPath: (persona as { avatarPath?: string | null }).avatarPath ?? null,
            appearance: (persona as { appearance?: string | null }).appearance ?? null,
          }
        : null,
      requestedNames: [charName],
      promptText: [charName, input.command.context ?? "", imagePrompt].join("\n"),
      fallbackToChatCharacters: false,
      maxReferences: 1,
    });
    if (input.metadata.selfieIncludeCharacterAppearance === true && referenceResolution.appearanceBlock) {
      finalPrompt += `\n\n${referenceResolution.appearanceBlock}`;
    }
    if (input.metadata.selfieUseAvatarReferences === true && referenceResolution.referenceImages.length > 0) {
      referenceImages = referenceResolution.referenceImages;
      if (referenceResolution.referenceLine && !suppressReferencePromptLine) {
        finalPrompt += `\n\n${referenceResolution.referenceLine}`;
      }
    }
  }

  const configuredStyleProfileId =
    parseJsonRecord(input.metadata.gameSetupConfig).imageStyleProfileId ?? input.metadata.imageStyleProfileId ?? null;
  const styleProfileId =
    typeof configuredStyleProfileId === "string" && configuredStyleProfileId.trim()
      ? configuredStyleProfileId.trim()
      : imageSettings.styleProfiles.defaultProfileId;
  const selfieResolution = typeof input.metadata.selfieResolution === "string" ? input.metadata.selfieResolution : "";
  const [selfieW, selfieH] = selfieResolution.split("x").map(Number) as [number, number];
  const compiledPrompt = compileImagePrompt({
    kind: "selfie",
    prompt: finalPrompt,
    negativePrompt: negativePrompt || undefined,
    styleProfiles: imageSettings.styleProfiles,
    styleProfileId,
    imageDefaults,
  });
  const imageResult = await generateImage(
    imageConn.model || "",
    imageConn.baseUrl || "https://image.pollinations.ai",
    imageConn.apiKey || "",
    imageConn.imageService || imageConn.imageGenerationSource || imageConn.model || "",
    {
      prompt: compiledPrompt.prompt,
      negativePrompt: compiledPrompt.negativePrompt || undefined,
      model: imageConn.model || "",
      width: selfieW || imageSettings.selfie.width,
      height: selfieH || imageSettings.selfie.height,
      imageEndpointId: imageConn.imageEndpointId || undefined,
      comfyWorkflow: imageConn.comfyuiWorkflow || undefined,
      imageDefaults,
      referenceImages,
    },
  );

  const filePath = saveImageToDisk(input.chat.id, imageResult.base64, imageResult.ext);
  const galleryEntry = await createGalleryStorage(input.app.db).create({
    chatId: input.chat.id,
    filePath,
    prompt: compiledPrompt.prompt,
    provider: imageConn.provider ?? "image_generation",
    model: imageConn.model || "unknown",
    width: selfieW || imageSettings.selfie.width,
    height: selfieH || imageSettings.selfie.height,
  });
  const filename = basename(filePath);
  const attachment: MessageAttachment = {
    type: "image",
    url: `/api/gallery/file/${input.chat.id}/${encodeURIComponent(filename)}`,
    filename: `selfie_${charName.toLowerCase().replace(/\s+/g, "_")}.${imageResult.ext}`,
    prompt: compiledPrompt.prompt,
    galleryId: galleryEntry?.id,
  };
  const message = await input.calls.createMessage({
    callId: input.session.id,
    chatId: input.session.chatId,
    role: "assistant",
    characterId: input.characterId,
    participantKind: "character",
    kind: "text",
    content: "sent a selfie.",
    extra: {
      attachments: [attachment],
      conversationCallCommandOutput: "selfie",
    },
  });
  logger.info("[conversation-call] Selfie generated for %s during call %s", charName, input.session.id);
  return message ? [message] : [];
}

function readCustomClipPrompt(commandText: string) {
  return (
    getCommandStringParam(commandText, "prompt") ||
    getCommandStringParam(commandText, "clip") ||
    getCommandStringParam(commandText, "action") ||
    getCommandStringParam(commandText, "description") ||
    getCommandStringParam(commandText, "context") ||
    getCommandRootStringValue(commandText)
  )
    .replace(/\s+/g, " ")
    .trim();
}

function readCustomClipLabel(commandText: string, prompt: string) {
  const explicit = getCommandStringParam(commandText, "label") || getCommandStringParam(commandText, "title");
  const label = (explicit || prompt).replace(/\s+/g, " ").trim();
  return (label || "Custom clip").slice(0, 80);
}

async function applyCallCustomClipCommand(input: {
  app: FastifyInstance;
  session: ConversationCallSession;
  calls: CallsStorage;
  chars: ReturnType<typeof createCharactersStorage>;
  characterId: string | null;
  commandText: string;
}): Promise<ConversationCallMessage[]> {
  if (!input.characterId) return [];
  const ttsSettings = await readTTSSettings(input.app);
  if (ttsSettings.callCharacterVideoEnabled !== true || ttsSettings.callCustomVideoClipsEnabled !== true) return [];
  const prompt = readCustomClipPrompt(input.commandText);
  if (prompt.length < 8) return [];
  const label = readCustomClipLabel(input.commandText, prompt);
  const [character, connection] = await Promise.all([
    input.chars.getById(input.characterId),
    createConnectionsStorage(input.app.db).getDefaultForVideoGeneration(),
  ]);
  if (!character || !connection) return [];
  const characterData = parseCharacterData(character);
  const videoSettings = normalizeVideoGenerationUserSettings(
    await createAppSettingsStorage(input.app.db).get(VIDEO_GENERATION_SETTINGS_KEY),
  );
  const manifest = await startConversationCallCustomVideoClipGeneration({
    characterId: character.id,
    characterName: readName(characterData, "Character"),
    avatarPath: character.avatarPath ?? null,
    connection,
    promptOverridesStorage: createPromptOverridesStorage(input.app.db),
    videoSettings,
    label,
    prompt,
  });
  const customClip = manifest.customClips.find((clip) => clip.label === label && clip.prompt === prompt) ?? null;
  const message = await input.calls.createMessage({
    callId: input.session.id,
    chatId: input.session.chatId,
    role: "system",
    characterId: character.id,
    participantKind: "character",
    kind: "system",
    content: `${readName(characterData, "Character")} is preparing a custom clip: ${label}.`,
    extra: {
      conversationCallCustomClip: {
        characterId: character.id,
        clipId: customClip?.id ?? null,
        label,
        prompt,
      },
    },
  });
  logger.info("[conversation-call] Custom video clip queued for %s during call %s", character.id, input.session.id);
  return message ? [message] : [];
}

async function executeCallConversationCommand(input: {
  app: FastifyInstance;
  chat: NonNullable<ChatRow>;
  session: ConversationCallSession;
  calls: CallsStorage;
  commandText: string;
  characterId: string | null;
  anchorMessageId?: string | null;
  sourceContent?: string | null;
}): Promise<ConversationCallMessage[]> {
  const commandName = getBracketCommandName(input.commandText);
  if (
    commandName === "end_call" ||
    commandName === "leave_call" ||
    commandName === "soundboard" ||
    commandName === "play_clip"
  ) {
    return [];
  }
  if (commandName === "custom_clip") {
    const chats = createChatsStorage(input.app.db);
    const chars = createCharactersStorage(input.app.db);
    const freshChat = (await chats.getById(input.chat.id)) ?? input.chat;
    const metadata = parseJsonRecord(freshChat.metadata);
    if (metadata.characterCommands === false) return [];
    return applyCallCustomClipCommand({
      app: input.app,
      session: input.session,
      calls: input.calls,
      chars,
      characterId: input.characterId,
      commandText: input.commandText,
    });
  }

  const parsed = parseCharacterCommands(input.commandText);
  if (parsed.commands.length === 0) {
    logger.debug("[conversation-call] Ignored unsupported call command: %s", input.commandText);
    return [];
  }

  const chats = createChatsStorage(input.app.db);
  const chars = createCharactersStorage(input.app.db);
  const freshChat = (await chats.getById(input.chat.id)) ?? input.chat;
  const metadata = parseJsonRecord(freshChat.metadata);
  if (metadata.characterCommands === false) return [];

  const createdMessages: ConversationCallMessage[] = [];
  for (const command of parsed.commands) {
    const key = getCallConversationCommandKey(command);
    if (key && !isCallConversationCommandEnabled(metadata, key)) continue;

    if (command.type === "schedule_update") {
      await applyCallScheduleUpdate({
        chats,
        chat: freshChat,
        metadata,
        characterId: input.characterId,
        command: command as ScheduleUpdateCommand,
      });
    } else if (command.type === "cross_post") {
      await applyCallCrossPostCommand({
        chats,
        chat: freshChat,
        characterId: input.characterId,
        command: command as CrossPostCommand,
        sourceContent: input.sourceContent,
      });
    } else if (command.type === "selfie") {
      createdMessages.push(
        ...(await applyCallSelfieCommand({
          app: input.app,
          chat: freshChat,
          session: input.session,
          calls: input.calls,
          metadata,
          chars,
          characterId: input.characterId,
          command: command as SelfieCommand,
        })),
      );
    } else if (command.type === "memory") {
      await applyCallMemoryCommand({ chars, characterId: input.characterId, command: command as MemoryCommand });
    } else if (command.type === "react") {
      await applyCallReactCommand({
        app: input.app,
        calls: input.calls,
        session: input.session,
        characterId: input.characterId,
        command: command as ReactCommand,
      });
    } else if (command.type === "spotify" || command.type === "youtube") {
      await applyCallMusicCommand({
        app: input.app,
        chat: freshChat,
        command: command as SpotifyCommand | YouTubeCommand,
      });
    } else if (command.type === "haptic") {
      await applyCallHapticCommand({ metadata, command: command as HapticCommand });
    } else if (command.type === "influence") {
      const connectedId = freshChat.connectedChatId;
      const content = stripConversationPromptTimestamps((command as InfluenceCommand).content);
      if (connectedId && content) {
        await chats.createInfluence(input.chat.id, connectedId, content, input.anchorMessageId ?? undefined);
        logger.info("[conversation-call] OOC influence queued for connected chat %s", connectedId);
      }
    } else if (command.type === "note") {
      const connectedId = freshChat.connectedChatId;
      const content = stripConversationPromptTimestamps((command as NoteCommand).content);
      if (connectedId && content) {
        await chats.createNote(input.chat.id, connectedId, content, input.anchorMessageId ?? undefined);
        logger.info("[conversation-call] Conversation note saved for connected chat %s", connectedId);
      }
    } else {
      logger.debug("[conversation-call] Call command %s parsed but has no call executor yet", command.type);
    }
  }
  return createdMessages;
}

async function persistCallAssistantTurns(input: {
  app: FastifyInstance;
  chat: NonNullable<ChatRow>;
  session: ConversationCallSession;
  calls: CallsStorage;
  turns: ConversationCallTurn[];
}): Promise<{
  assistantMessages: ConversationCallMessage[];
  session: ConversationCallSession;
  turns: ConversationCallTurn[];
}> {
  const assistantMessages: ConversationCallMessage[] = [];
  const resolvedTurns: ConversationCallTurn[] = [];
  let responseSession: ConversationCallSession = input.session;
  const metadata = parseJsonRecord(input.chat.metadata);
  const allCharacterIds = readCharacterIds(input.chat.characterIds);
  const availableCharacterIds = getAvailableCallCharacterIds(metadata, allCharacterIds);
  const characters = await resolveCallCharacters(createCharactersStorage(input.app.db), availableCharacterIds, {
    metadata,
  });
  const ttsSettings = await readTTSSettings(input.app);
  let lastVisibleAssistantContent: string | null = null;
  for (const turn of input.turns) {
    const characterId = resolveTurnCharacterId(turn, characters);
    if (!characterId) continue;
    const character = characters.find((candidate) => candidate.id === characterId);
    const effectiveMode =
      turn.mode === "voice" && character && !characterCanSpeak(ttsSettings, character) ? "text" : turn.mode;
    const turnWithResolvedCharacter = { ...turn, mode: effectiveMode, characterId };
    resolvedTurns.push(turnWithResolvedCharacter);
    if (effectiveMode === "command") {
      const command = normalizeBracketCommand(turn.content) ?? "[command]";
      const commandTurn = { ...turnWithResolvedCharacter, content: command, command };
      const commandMessage = await input.calls.createMessage({
        callId: input.session.id,
        chatId: input.session.chatId,
        role: "system",
        characterId,
        participantKind: "character",
        kind: "command",
        content: command,
        extra: { turn: commandTurn },
      });
      if (commandMessage) assistantMessages.push(commandMessage);
      const commandOutputMessages = await executeCallConversationCommand({
        app: input.app,
        chat: input.chat,
        session: input.session,
        calls: input.calls,
        commandText: command,
        characterId,
        anchorMessageId: commandMessage?.id ?? null,
        sourceContent: lastVisibleAssistantContent,
      });
      assistantMessages.push(...commandOutputMessages);
      if (getBracketCommandName(command) === "end_call") {
        // The client finalizes the call after it has played any preceding voice turns.
        // Ending here would make the UI collapse before the character finishes speaking.
        break;
      }
      continue;
    }
    const assistantMessage = await input.calls.createMessage({
      callId: input.session.id,
      chatId: input.session.chatId,
      role: "assistant",
      characterId,
      participantKind: "character",
      kind: effectiveMode === "voice" ? "speech" : "text",
      content: turn.content,
      extra: { turn: turnWithResolvedCharacter },
    });
    if (assistantMessage) assistantMessages.push(assistantMessage);
    lastVisibleAssistantContent = assistantMessage?.content ?? turn.content;
  }
  return {
    assistantMessages,
    turns: resolvedTurns,
    session:
      responseSession.status === "ended"
        ? responseSession
        : ((await input.calls.getSession(input.session.id)) ?? input.session),
  };
}

async function summarizeCall(input: {
  app: FastifyInstance;
  chat: NonNullable<ChatRow>;
  session: ConversationCallSession;
}) {
  const calls = createConversationCallsStorage(input.app.db);
  const connections = createConnectionsStorage(input.app.db);
  const messages = await calls.listMessages(input.session.id);
  if (messages.length === 0) return "No substantial conversation occurred during the call.";
  const connectionId = input.chat.connectionId;
  if (!connectionId) {
    return messages
      .slice(-12)
      .map((message) => `${message.participantKind === "user" ? "User" : "Character"}: ${message.content}`)
      .join("\n");
  }
  const conn = await connections.getWithKey(connectionId);
  if (!conn) return "Call ended. Summary unavailable because the chat connection could not be resolved.";
  const provider = createLLMProvider(
    conn.provider,
    resolveBaseUrl(conn),
    conn.apiKey,
    conn.maxContext,
    conn.openrouterProvider,
    conn.maxTokensOverride,
    conn.claudeFastMode === "true",
    conn.treatAsLocalEndpoint === "true",
  );
  const transcript = messages.map((message) => `${message.participantKind}:${message.content}`).join("\n");
  try {
    const result = await provider.chatComplete(
      [
        {
          role: "system",
          content:
            "Summarize this audio call for future chat context in 3-6 concise sentences. Keep concrete plans, emotional shifts, decisions, and notable events.",
        },
        { role: "user", content: transcript },
      ],
      { model: conn.model, maxTokens: 600, temperature: 0.2 },
    );
    return (result.content ?? "").trim() || "Call ended. No summary was generated.";
  } catch (error) {
    logger.warn(error, "[conversation-call] Failed to summarize call %s", input.session.id);
    return "Call ended. Summary generation failed.";
  }
}

async function endConversationCallWithSummary(input: {
  app: FastifyInstance;
  chat: NonNullable<ChatRow>;
  session: ConversationCallSession;
}) {
  if (input.session.status === "ended") return input.session;
  const chats = createChatsStorage(input.app.db);
  const calls = createConversationCallsStorage(input.app.db);
  const startedAt = getSessionStartedAt(input.session);
  const durationMs = Date.now() - startedAt;
  const ended = await calls.updateStatus(input.session.id, "ended");
  const duration = formatDuration(durationMs);
  await chats.createMessagesBatch(input.session.chatId, [
    {
      role: "system",
      characterId: input.session.initiatorCharacterId,
      content: `Call ended after ${duration}`,
      extra: {
        displayText: null,
        isGenerated: true,
        tokenCount: null,
        generationInfo: null,
        conversationCallEvent: {
          callId: input.session.id,
          status: "ended",
          durationMs,
          summary: null,
        },
      },
    },
  ]);
  if (ended) {
    void finalizeConversationCallSummary({ app: input.app, chat: input.chat, session: ended }).catch((error) => {
      logger.warn(error, "[conversation-call] Background summary finalization failed for call %s", input.session.id);
    });
  }
  return ended;
}

async function finalizeConversationCallSummary(input: {
  app: FastifyInstance;
  chat: NonNullable<ChatRow>;
  session: ConversationCallSession;
}) {
  const calls = createConversationCallsStorage(input.app.db);
  const existing = await calls.getSession(input.session.id);
  if (!existing || existing.summary) return existing;
  const chats = createChatsStorage(input.app.db);
  const summary = await summarizeCall(input);
  await calls.updateSummary(input.session.id, summary);
  await chats.createMessagesBatch(input.session.chatId, [
    {
      role: "system",
      characterId: null,
      content: `[Audio call summary: ${summary}]`,
      extra: {
        hiddenFromUser: true,
        displayText: null,
        isGenerated: true,
        tokenCount: null,
        generationInfo: null,
        conversationCallSummary: true,
        callId: input.session.id,
      },
    },
  ]);
  return calls.getSession(input.session.id);
}

async function readTTSSettings(app: FastifyInstance): Promise<Record<string, unknown>> {
  const storage = createAppSettingsStorage(app.db);
  const raw = await storage.get("tts");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readCallGreeting(session: ConversationCallSession) {
  const greeting = session.metadata?.greeting;
  return typeof greeting === "string" ? greeting.trim() : "";
}

async function createInitialCallGreeting(input: {
  calls: CallsStorage;
  characters: ReturnType<typeof createCharactersStorage>;
  session: ConversationCallSession;
  ttsSettings: Record<string, unknown>;
}) {
  const greeting = readCallGreeting(input.session);
  if (!greeting || input.session.initiator !== "character" || !input.session.initiatorCharacterId) return null;
  const existingGreeting = (await input.calls.listMessages(input.session.id)).find(
    (message) => message.extra?.conversationCallInitialGreeting === true,
  );
  if (existingGreeting) return existingGreeting;

  const character = await input.characters.getById(input.session.initiatorCharacterId);
  if (!character) return null;
  const characterData = parseCharacterData(character);
  const speakerName = readName(characterData, "Character");
  const mode = characterCanSpeak(input.ttsSettings, { id: character.id, name: speakerName }) ? "voice" : "text";
  const turn: ConversationCallTurn = {
    speakerName,
    characterId: character.id,
    mode,
    content: greeting,
    tone: mode === "voice" ? "opening call greeting" : null,
  };

  return input.calls.createMessage({
    callId: input.session.id,
    chatId: input.session.chatId,
    role: "assistant",
    characterId: character.id,
    participantKind: "character",
    kind: mode === "voice" ? "speech" : "text",
    content: greeting,
    extra: {
      turn,
      conversationCallInitialGreeting: true,
      conversationCallInitialGreetingPlayed: false,
      conversationCallAutoplay: true,
    },
  });
}

function ensureSoundboardDir() {
  mkdirSync(SOUNDBOARD_ROOT, { recursive: true });
  return SOUNDBOARD_ROOT;
}

export async function conversationCallsRoutes(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  const calls = createConversationCallsStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const characters = createCharactersStorage(app.db);

  app.get<{ Params: { chatId: string } }>("/chat/:chatId/status", async (req) => {
    const [activeCall, ringingCall] = await Promise.all([
      calls.getActiveForChat(req.params.chatId),
      calls.getRingingForChat(req.params.chatId),
    ]);
    return { activeCall, ringingCall };
  });

  app.get<{ Params: { characterId: string } }>("/character-videos/:characterId", async (req, reply) => {
    const character = await characters.getById(req.params.characterId);
    if (!character) return reply.status(404).send({ error: "Character not found" });
    const data = parseCharacterData(character);
    return getConversationCallCharacterVideoManifest({
      characterId: character.id,
      characterName: readName(data, "Character"),
      avatarPath: character.avatarPath ?? null,
    });
  });

  app.post<{ Params: { characterId: string } }>("/character-videos/:characterId/generate", async (req, reply) => {
    const character = await characters.getById(req.params.characterId);
    if (!character) return reply.status(404).send({ error: "Character not found" });
    const ttsSettings = await readTTSSettings(app);
    if (ttsSettings.callCharacterVideoEnabled !== true) {
      return reply.status(403).send({ error: "Character video presence is not enabled for Conversation Calls." });
    }
    const data = parseCharacterData(character);
    const body = parseJsonRecord(req.body);
    let videoConnection: Awaited<ReturnType<typeof resolveRequestedVideoGenerationConnection>>;
    let clipKinds: ConversationCallCharacterVideoClipKind[] | null = null;
    try {
      videoConnection = await resolveRequestedVideoGenerationConnection(connections, body);
      clipKinds = parseCallVideoClipKinds(body);
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid call clip request." });
    }
    const videoSettings = normalizeVideoGenerationUserSettings(
      await createAppSettingsStorage(app.db).get(VIDEO_GENERATION_SETTINGS_KEY),
    );
    return startConversationCallCharacterVideoGeneration({
      characterId: character.id,
      characterName: readName(data, "Character"),
      avatarPath: character.avatarPath ?? null,
      clipKinds,
      connection: videoConnection,
      promptOverridesStorage: createPromptOverridesStorage(app.db),
      videoSettings,
      debugMode: body.debugMode === true,
      includeAvatarReference: body.includeAvatarReference !== false,
    });
  });

  app.post<{ Params: { characterId: string } }>(
    "/character-videos/:characterId/custom/generate",
    async (req, reply) => {
      const character = await characters.getById(req.params.characterId);
      if (!character) return reply.status(404).send({ error: "Character not found" });
      const ttsSettings = await readTTSSettings(app);
      if (ttsSettings.callCharacterVideoEnabled !== true) {
        return reply.status(403).send({ error: "Character video presence is not enabled for Conversation Calls." });
      }
      const data = parseCharacterData(character);
      const body = parseJsonRecord(req.body);
      const label = typeof body.label === "string" ? body.label.trim() : "";
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!label || !prompt) {
        return reply.status(400).send({ error: "Custom clips need a name and action." });
      }
      let videoConnection: Awaited<ReturnType<typeof resolveRequestedVideoGenerationConnection>>;
      try {
        videoConnection = await resolveRequestedVideoGenerationConnection(connections, body);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid call clip request." });
      }
      const videoSettings = normalizeVideoGenerationUserSettings(
        await createAppSettingsStorage(app.db).get(VIDEO_GENERATION_SETTINGS_KEY),
      );
      return startConversationCallCustomVideoClipGeneration({
        characterId: character.id,
        characterName: readName(data, "Character"),
        avatarPath: character.avatarPath ?? null,
        connection: videoConnection,
        promptOverridesStorage: createPromptOverridesStorage(app.db),
        videoSettings,
        label,
        prompt,
        debugMode: body.debugMode === true,
        includeAvatarReference: body.includeAvatarReference !== false,
      });
    },
  );

  app.get<{ Params: { personaId: string } }>("/persona-videos/:personaId", async (req, reply) => {
    const persona = await characters.getPersona(req.params.personaId);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });
    const personaName = typeof persona.name === "string" && persona.name.trim() ? persona.name.trim() : "Persona";
    return getConversationCallCharacterVideoManifest({
      characterId: req.params.personaId,
      characterName: personaName,
      avatarPath: persona.avatarPath ?? null,
    });
  });

  app.post<{ Params: { personaId: string } }>("/persona-videos/:personaId/generate", async (req, reply) => {
    const persona = await characters.getPersona(req.params.personaId);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });
    const ttsSettings = await readTTSSettings(app);
    if (ttsSettings.callCharacterVideoEnabled !== true) {
      return reply.status(403).send({ error: "Character video presence is not enabled for Conversation Calls." });
    }
    const body = parseJsonRecord(req.body);
    let videoConnection: Awaited<ReturnType<typeof resolveRequestedVideoGenerationConnection>>;
    let clipKinds: ConversationCallCharacterVideoClipKind[] | null = null;
    try {
      videoConnection = await resolveRequestedVideoGenerationConnection(connections, body);
      clipKinds = parseCallVideoClipKinds(body);
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid call clip request." });
    }
    const videoSettings = normalizeVideoGenerationUserSettings(
      await createAppSettingsStorage(app.db).get(VIDEO_GENERATION_SETTINGS_KEY),
    );
    const personaName = typeof persona.name === "string" && persona.name.trim() ? persona.name.trim() : "Persona";
    return startConversationCallCharacterVideoGeneration({
      characterId: req.params.personaId,
      characterName: personaName,
      avatarPath: persona.avatarPath ?? null,
      clipKinds,
      connection: videoConnection,
      promptOverridesStorage: createPromptOverridesStorage(app.db),
      videoSettings,
      debugMode: body.debugMode === true,
      includeAvatarReference: body.includeAvatarReference !== false,
    });
  });

  app.post<{ Params: { personaId: string } }>("/persona-videos/:personaId/custom/generate", async (req, reply) => {
    const persona = await characters.getPersona(req.params.personaId);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });
    const ttsSettings = await readTTSSettings(app);
    if (ttsSettings.callCharacterVideoEnabled !== true) {
      return reply.status(403).send({ error: "Character video presence is not enabled for Conversation Calls." });
    }
    const body = parseJsonRecord(req.body);
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!label || !prompt) {
      return reply.status(400).send({ error: "Custom clips need a name and action." });
    }
    let videoConnection: Awaited<ReturnType<typeof resolveRequestedVideoGenerationConnection>>;
    try {
      videoConnection = await resolveRequestedVideoGenerationConnection(connections, body);
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Invalid call clip request." });
    }
    const videoSettings = normalizeVideoGenerationUserSettings(
      await createAppSettingsStorage(app.db).get(VIDEO_GENERATION_SETTINGS_KEY),
    );
    const personaName = typeof persona.name === "string" && persona.name.trim() ? persona.name.trim() : "Persona";
    return startConversationCallCustomVideoClipGeneration({
      characterId: req.params.personaId,
      characterName: personaName,
      avatarPath: persona.avatarPath ?? null,
      connection: videoConnection,
      promptOverridesStorage: createPromptOverridesStorage(app.db),
      videoSettings,
      label,
      prompt,
      debugMode: body.debugMode === true,
      includeAvatarReference: body.includeAvatarReference !== false,
    });
  });

  app.get<{ Params: { characterId: string; kind: string } }>(
    "/character-videos/:characterId/file/:kind",
    async (req, reply) => {
      const kind = req.params.kind as ConversationCallCharacterVideoClipKind;
      if (!CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.includes(kind)) {
        return reply.status(400).send({ error: "Invalid call video clip kind" });
      }
      const file = getConversationCallCharacterVideoFile(req.params.characterId, kind);
      if (!file) return reply.status(404).send({ error: "Call video clip not found" });
      return reply
        .header("Content-Type", "video/mp4")
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .send(createReadStream(file));
    },
  );

  app.get<{ Params: { characterId: string; clipId: string } }>(
    "/character-videos/:characterId/custom/:clipId/file",
    async (req, reply) => {
      const file = getConversationCallCustomVideoClipFile(req.params.characterId, req.params.clipId);
      if (!file) return reply.status(404).send({ error: "Custom call video clip not found" });
      return reply
        .header("Content-Type", "video/mp4")
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .send(createReadStream(file));
    },
  );

  app.post("/start", async (req, reply) => {
    const input = startConversationCallSchema.parse(req.body);
    const chat = await chats.getById(input.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    if (chat.mode !== "conversation")
      return reply.status(400).send({ error: "Calls are only available in Conversation mode" });
    const meta = parseJsonRecord(chat.metadata);
    if (input.initiator !== "character" && meta.conversationCallsEnabled !== true)
      return reply.status(400).send({ error: "Calls are not enabled for this conversation" });
    const ttsSettings = await readTTSSettings(app);
    if (ttsSettings.callAudioEnabled !== true) {
      return reply.status(400).send({ error: "Conversation call audio is not enabled in Chat Settings" });
    }
    const commandToggles = parseJsonRecord(meta.conversationCommandToggles);
    if (input.initiator === "character" && (meta.characterCommands === false || commandToggles.call === false)) {
      return reply.status(400).send({ error: "Characters cannot call in this conversation" });
    }
    const existingActive = await calls.getActiveForChat(chat.id);
    if (existingActive) return existingActive;
    const existingRinging = await calls.getRingingForChat(chat.id);
    if (existingRinging) return existingRinging;
    const session = await calls.createSession(input);
    if (!session) return reply.status(500).send({ error: "Failed to create call" });
    const eventContent = session.status === "ringing" ? "Incoming call" : "Started an audio call";
    await chats.createMessagesBatch(chat.id, [
      {
        role: "system",
        characterId: input.initiatorCharacterId ?? null,
        content: eventContent,
        extra: {
          displayText: null,
          isGenerated: true,
          tokenCount: null,
          generationInfo: null,
          conversationCallEvent: {
            callId: session.id,
            status: session.status,
            mode: session.mode,
            initiator: session.initiator,
            reason: input.metadata?.reason ?? null,
          },
        },
      },
    ]);
    return session;
  });

  app.post<{ Params: { id: string } }>("/:id/accept", async (req, reply) => {
    const session = await calls.getSession(req.params.id);
    if (!session) return reply.status(404).send({ error: "Call not found" });
    if (session.status !== "ringing") return session;
    const activeSession = await calls.updateStatus(session.id, "active");
    if (activeSession) {
      await createInitialCallGreeting({
        calls,
        characters,
        session: activeSession,
        ttsSettings: await readTTSSettings(app),
      });
    }
    await chats.createMessagesBatch(session.chatId, [
      {
        role: "system",
        characterId: session.initiatorCharacterId,
        content: "Started an audio call",
        extra: {
          displayText: null,
          isGenerated: true,
          tokenCount: null,
          generationInfo: null,
          conversationCallEvent: {
            callId: session.id,
            status: "active",
            mode: session.mode,
            initiator: session.initiator,
          },
        },
      },
    ]);
    return activeSession;
  });

  app.post<{ Params: { id: string } }>("/:id/decline", async (req, reply) => {
    const session = await calls.getSession(req.params.id);
    if (!session) return reply.status(404).send({ error: "Call not found" });
    const updated = await calls.updateStatus(session.id, "declined");
    await chats.createMessagesBatch(session.chatId, [
      {
        role: "system",
        characterId: session.initiatorCharacterId,
        content: "Call declined",
        extra: {
          displayText: null,
          isGenerated: true,
          tokenCount: null,
          generationInfo: null,
          conversationCallEvent: {
            callId: session.id,
            status: "declined",
            mode: session.mode,
            initiator: session.initiator,
          },
        },
      },
    ]);
    return updated;
  });

  app.post<{ Params: { id: string } }>("/:id/end", async (req, reply) => {
    const session = await calls.getSession(req.params.id);
    if (!session) return reply.status(404).send({ error: "Call not found" });
    const chat = await chats.getById(session.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const ended = await endConversationCallWithSummary({ app, chat, session });
    return ended;
  });

  app.get<{ Params: { id: string } }>("/:id/messages", async (req, reply) => {
    const session = await calls.getSession(req.params.id);
    if (!session) return reply.status(404).send({ error: "Call not found" });
    return calls.listMessages(session.id);
  });

  app.patch<{ Params: { id: string; messageId: string } }>("/:id/messages/:messageId/extra", async (req, reply) => {
    const session = await calls.getSession(req.params.id);
    if (!session) return reply.status(404).send({ error: "Call not found" });
    const message = await calls.getMessage(req.params.messageId);
    if (!message || message.callId !== session.id) {
      return reply.status(404).send({ error: "Call message not found" });
    }
    const updated = await calls.updateMessageExtra(message.id, sanitizeCallMessageExtraPatch(req.body));
    if (!updated) return reply.status(404).send({ error: "Call message not found" });
    return updated;
  });

  app.post<{ Params: { id: string } }>("/:id/interruption", async (req, reply) => {
    const session = await calls.getSession(req.params.id);
    if (!session) return reply.status(404).send({ error: "Call not found" });
    if (session.status !== "active") return reply.status(400).send({ error: "Call is not active" });
    const input = conversationCallInterruptionSchema.parse(req.body ?? {});
    const spokenText = input.spokenText.trim();
    const speakerName = input.speakerName?.trim() || "the character";
    const content = [
      "[User interrupted when you were speaking this.]",
      spokenText ? `${speakerName} was saying: ${spokenText}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const message = await calls.createMessage({
      callId: session.id,
      chatId: session.chatId,
      role: "system",
      characterId: input.characterId ?? null,
      participantKind: "character",
      kind: "system",
      content,
      extra: {
        hiddenFromUser: true,
        conversationCallInterruption: true,
        speakerName,
        spokenText,
      },
    });
    if (!message) return reply.status(500).send({ error: "Failed to save interruption marker" });
    return message;
  });

  app.post<{ Params: { id: string } }>("/:id/messages", async (req, reply) => {
    const session = await calls.getSession(req.params.id);
    if (!session) return reply.status(404).send({ error: "Call not found" });
    if (session.status !== "active") return reply.status(400).send({ error: "Call is not active" });
    const input = sendConversationCallMessageSchema.parse(req.body) as {
      content: string;
      inputMode: "typed" | "speech";
      debugMode: boolean;
      musicPlayerEnabled?: boolean;
      musicPlayerSource?: "spotify" | "youtube" | "custom";
    };
    const chat = await chats.getById(session.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const userMessage = await calls.createMessage({
      callId: session.id,
      chatId: session.chatId,
      role: "user",
      participantKind: "user",
      kind: input.inputMode === "speech" ? "speech" : "text",
      content: input.content,
    });
    if (!userMessage) return reply.status(500).send({ error: "Failed to save call message" });

    const { turns } = await createCallTurns({
      app,
      chat,
      session,
      connections,
      userText: input.content,
      userInputKind: input.inputMode === "speech" ? "speech" : "text",
      latestCallMessageId: userMessage.id,
      debugMode: input.debugMode,
      musicPlayerEnabled: input.musicPlayerEnabled,
      musicPlayerSource: input.musicPlayerSource,
    });
    const persisted = await persistCallAssistantTurns({ app, chat, session, calls, turns });
    return {
      userMessage,
      assistantMessages: persisted.assistantMessages,
      turns: persisted.turns,
      session: persisted.session,
    };
  });

  app.post<{ Params: { id: string } }>("/:id/idle", async (req, reply) => {
    const session = await calls.getSession(req.params.id);
    if (!session) return reply.status(404).send({ error: "Call not found" });
    if (session.status !== "active") return reply.status(400).send({ error: "Call is not active" });
    const input = conversationCallIdleSchema.parse(req.body ?? {}) as {
      quietMs: number;
      debugMode: boolean;
      musicPlayerEnabled?: boolean;
      musicPlayerSource?: "spotify" | "youtube" | "custom";
    };
    const chat = await chats.getById(session.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const userText = [
      `[Call silence check: The user has not spoken or typed for ${formatQuietDuration(input.quietMs)}.`,
      "This is not a user message. If the user recently said they were going brb, away, busy, sleeping, or intentionally quiet, return an empty turns array and wait patiently.",
      "Otherwise, generate at most one brief, gentle check-in asking if they are still there or all right.]",
    ].join(" ");
    const { turns } = await createCallTurns({
      app,
      chat,
      session,
      connections,
      userText,
      userInputKind: "system",
      debugMode: input.debugMode,
      musicPlayerEnabled: input.musicPlayerEnabled,
      musicPlayerSource: input.musicPlayerSource,
    });
    const persisted = await persistCallAssistantTurns({ app, chat, session, calls, turns });
    return {
      assistantMessages: persisted.assistantMessages,
      turns: persisted.turns,
      session: persisted.session,
    };
  });

  app.post<{ Params: { id: string } }>("/:id/media", async (req, reply) => {
    const session = await calls.getSession(req.params.id);
    if (!session) return reply.status(404).send({ error: "Call not found" });
    if (session.status !== "active") return reply.status(400).send({ error: "Call is not active" });
    const chat = await chats.getById(session.chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const ttsSettings = await readTTSSettings(app);
    if (ttsSettings.callAudioEnabled !== true) {
      return reply.status(400).send({ error: "Conversation call audio is not enabled in Chat Settings" });
    }
    const data = await req.file({ limits: { fileSize: MAX_AUDIO_UPLOAD_BYTES } });
    if (!data) return reply.status(400).send({ error: "No media uploaded" });
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const requestDebug = fields?.debugMode?.value === "true";
    const requestMusicPlayerEnabled =
      fields?.musicPlayerEnabled?.value === "true"
        ? true
        : fields?.musicPlayerEnabled?.value === "false"
          ? false
          : undefined;
    const requestMusicPlayerSource =
      fields?.musicPlayerSource?.value === "spotify" ||
      fields?.musicPlayerSource?.value === "youtube" ||
      fields?.musicPlayerSource?.value === "custom"
        ? fields.musicPlayerSource.value
        : undefined;
    const requestedKind = fields?.kind?.value === "video" || fields?.kind?.value === "audio" ? fields.kind.value : null;
    const mimeType = data.mimetype || (requestedKind === "video" ? "video/webm" : "audio/webm");
    const kind = requestedKind ?? mediaKindFromMime(mimeType, data.filename || "");
    if (!kind) return reply.status(400).send({ error: "Unsupported call media type" });
    if (kind === "video" && ttsSettings.callVideoInputEnabled !== true) {
      return reply.status(400).send({ error: "Video input is disabled in Chat Settings" });
    }

    const nativePreferred =
      fields?.nativePreferred?.value === "true" &&
      (typeof ttsSettings.callAudioInputMode !== "string" ||
        ttsSettings.callAudioInputMode === "auto" ||
        ttsSettings.callAudioInputMode === "transcribe");
    const localWhisperRequested =
      fields?.transcriptionMode?.value === "local_whisper" &&
      (ttsSettings.callAudioInputMode === "local_whisper" || ttsSettings.callAudioInputMode === "transcribe");

    if (localWhisperRequested) {
      if (kind !== "audio") {
        return reply.status(400).send({ error: "Local Whisper transcription only accepts audio input" });
      }
      let transcript = "";
      try {
        transcript = (await sidecarSpeechService.transcribeWav(buffer)).trim();
      } catch (error) {
        logger.warn(error, "[conversation-call] Local Whisper transcription failed");
        return reply.status(400).send({
          error: error instanceof Error ? error.message : "Local Whisper transcription failed",
        });
      }
      if (!transcript) {
        return reply.status(400).send({ error: "Local Whisper did not return a transcript" });
      }
      if (isBlankAudioTranscript(transcript)) {
        return reply.status(400).send({ error: "Local Whisper did not detect speech." });
      }
      const userMessage = await calls.createMessage({
        callId: session.id,
        chatId: session.chatId,
        role: "user",
        participantKind: "user",
        kind: "speech",
        content: transcript,
        extra: {
          localWhisper: true,
          mimeType,
        },
      });
      if (!userMessage) return reply.status(500).send({ error: "Failed to save call message" });

      const { turns } = await createCallTurns({
        app,
        chat,
        session,
        connections,
        userText: transcript,
        userInputKind: "speech",
        latestCallMessageId: userMessage.id,
        debugMode: requestDebug,
        musicPlayerEnabled: requestMusicPlayerEnabled,
        musicPlayerSource: requestMusicPlayerSource,
      });
      const persisted = await persistCallAssistantTurns({ app, chat, session, calls, turns });
      return {
        userMessage,
        assistantMessages: persisted.assistantMessages,
        turns: persisted.turns,
        session: persisted.session,
      };
    }

    const conn = chat.connectionId ? await connections.getWithKey(chat.connectionId) : null;
    const canSendNative =
      nativePreferred &&
      conn &&
      canSendNativeCallMedia({
        provider: conn.provider,
        model: conn.model,
        kind,
        mimeType,
        filename: data.filename || "",
        byteLength: buffer.byteLength,
      });

    if (canSendNative && conn) {
      const content = nativeMediaContentLabel(kind, mimeType);
      const nativeMedia: ChatMediaAttachment[] = [
        {
          kind,
          data: dataUrlFromBuffer(buffer, mimeType),
          mimeType,
          filename: data.filename || (kind === "video" ? "call-video.webm" : "call-audio.webm"),
        },
      ];
      try {
        const { turns } = await createCallTurns({
          app,
          chat,
          session,
          connections,
          userText: content,
          userInputKind: "speech",
          nativeMedia,
          throwOnGenerationError: true,
          debugMode: requestDebug,
          musicPlayerEnabled: requestMusicPlayerEnabled,
          musicPlayerSource: requestMusicPlayerSource,
        });
        const userMessage = await calls.createMessage({
          callId: session.id,
          chatId: session.chatId,
          role: "user",
          participantKind: "user",
          kind: "speech",
          content,
          extra: {
            providerNativeMedia: true,
            mediaKind: kind,
            mimeType,
            provider: conn.provider,
            model: conn.model,
          },
        });
        if (!userMessage) return reply.status(500).send({ error: "Failed to save call message" });
        const persisted = await persistCallAssistantTurns({ app, chat, session, calls, turns });
        return {
          userMessage,
          assistantMessages: persisted.assistantMessages,
          turns: persisted.turns,
          session: persisted.session,
        };
      } catch (error) {
        logger.warn(error, "[conversation-call] Native media dispatch failed; falling back when possible");
        if (kind === "video") {
          return reply.status(502).send({ error: "Selected model could not process native video input" });
        }
      }
    }

    if (kind !== "audio") {
      return reply.status(400).send({ error: "Selected provider/model cannot receive native video input" });
    }

    return reply.status(400).send({
      error:
        ttsSettings.callAudioInputMode === "transcribe"
          ? "This browser could not transcribe speech directly. Download Local Whisper from Connections, choose provider-native audio/video, or use manual system dictation."
          : "Selected provider/model cannot receive provider-native audio input. Choose another audio input mode.",
    });
  });

  app.get("/soundboard", async () => calls.listSounds());

  app.post("/soundboard/upload", async (req, reply) => {
    const data = await req.file({ limits: { fileSize: MAX_SOUND_BYTES } });
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_SOUND_EXTS.has(ext)) return reply.status(400).send({ error: `Unsupported sound file type: ${ext}` });
    const dir = ensureSoundboardDir();
    const filename = `${newId()}${ext}`;
    const filePath = assertInsideDir(SOUNDBOARD_ROOT, join(dir, filename));
    try {
      await pipeline(data.file, createWriteStream(filePath));
    } catch (error) {
      if (existsSync(filePath)) unlinkSync(filePath);
      logger.warn(error, "[conversation-call] Failed to receive soundboard upload");
      return reply.status(400).send({ error: "Failed to read uploaded sound." });
    }
    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const name = (fields?.name?.value ?? basename(data.filename, ext)).trim().slice(0, 80) || "Sound";
    return calls.createSound({ name, filePath, mimeType: data.mimetype || "audio/mpeg" });
  });

  app.get<{ Params: { id: string } }>("/soundboard/:id/file", async (req, reply) => {
    const sound = await calls.getSound(req.params.id);
    if (!sound || !sound.filePath) return reply.status(404).send({ error: "Sound not found" });
    if (!existsSync(sound.filePath)) return reply.status(404).send({ error: "Sound file missing" });
    reply.type(sound.mimeType);
    return reply.send(createReadStream(sound.filePath));
  });

  app.delete<{ Params: { id: string } }>("/soundboard/:id", async (req, reply) => {
    const sound = await calls.deleteSound(req.params.id);
    if (!sound) return reply.status(404).send({ error: "Sound not found" });
    if (!sound.builtIn && sound.filePath && existsSync(sound.filePath)) unlinkSync(sound.filePath);
    return reply.status(204).send();
  });
}
