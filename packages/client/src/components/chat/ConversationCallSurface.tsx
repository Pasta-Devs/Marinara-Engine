import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  Send,
  Sparkles,
  Upload,
  Trash2,
  Loader2,
  Volume2,
  VolumeX,
  Paperclip,
  Smile,
  Keyboard,
  MessageCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type {
  ConversationCallCharacterVideoCustomClip,
  ConversationCallCharacterVideoClipKind,
  ConversationCallCharacterVideoManifest,
  ConversationCallMessage,
  ConversationCallSession,
  ConversationCallSound,
  ConversationCallTurn,
  MessageAttachment,
  MessageReaction,
} from "@marinara-engine/shared";
import { cn, generateClientId, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import type { CharacterMap, PersonaInfo } from "./chat-area.types";
import {
  conversationCallKeys,
  useConversationCallMessages,
  useConversationCallSoundboard,
  useConversationCallCharacterVideos,
  useDeleteConversationCallSound,
  useEndConversationCall,
  useGenerateConversationCallCharacterVideos,
  useSendConversationCallMedia,
  useSendConversationCallIdle,
  useSendConversationCallMessage,
  useRecordConversationCallInterruption,
  useUpdateConversationCallMessageExtra,
  useUploadConversationCallSound,
} from "../../hooks/use-conversation-calls";
import { useUIStore } from "../../stores/ui.store";
import { getChatInputShellClass } from "./chat-input-styles";
import {
  ConversationMediaPickerPanel,
  type ConversationMediaPickerTab,
  type ConversationMediaPickerTabId,
} from "./ConversationMediaPickerPanel";
import { QuickConnectionSwitcher } from "./QuickConnectionSwitcher";
import {
  getBrowserSpeechRecognitionCtor,
  isBrowserSpeechRecognitionSupported,
  readBrowserSpeechRecognitionTranscript,
  type BrowserSpeechRecognition,
} from "../../lib/browser-speech-recognition";
import { useTTSConfig } from "../../hooks/use-tts";
import { resolveTTSVoiceForSpeaker } from "../../lib/tts-dialogue";
import { ttsService } from "../../lib/tts-service";
import {
  playConversationCallEndSound,
  playConversationCallJoinSound,
  playConversationCallLeaveSound,
  playConversationCallStartSound,
} from "../../lib/conversation-call-sounds";
import { useAgentStore } from "../../stores/agent.store";
import { ReactionAddButton } from "./ReactionAddButton";
import { MessageReactions } from "./MessageReactions";
import { toggleReaction, USER_REACTOR } from "../../lib/reactions";
import { api } from "../../lib/api-client";

interface ConversationCallSurfaceProps {
  chatId: string;
  session: ConversationCallSession;
  characterMap: CharacterMap;
  chatCharIds: string[];
  personaInfo?: PersonaInfo;
  onEnded?: () => void;
  embedded?: boolean;
}

type Participant = {
  id: string;
  name: string;
  phoneticName?: string;
  avatarUrl: string | null;
  avatarCrop?: AvatarCropValue | null;
  kind: "user" | "character";
  characterId: string | null;
  canSpeak: boolean;
  conversationStatus?: "online" | "idle" | "dnd" | "offline";
};

type MobileCallPickerTab = Extract<ConversationMediaPickerTabId, "emoji" | "gifs" | "stickers">;
type LiveMicSegment = {
  recorder: MediaRecorder;
  chunks: BlobPart[];
  startedAt: number;
  includeVideo: boolean;
  voicedMs: number;
  peakRms: number;
};
type ParticipantTileDensity = "large" | "medium" | "small" | "compact";
type ActiveCallVoice = {
  key: string;
  characterId: string | null;
  speakerName: string;
  spokenText: string;
};
type CharacterVideoPlaybackState = {
  kind: ConversationCallCharacterVideoClipKind;
  followKind?: ConversationCallCharacterVideoClipKind;
  voiceKey: string;
  nonce: number;
  customClip?: ConversationCallCharacterVideoCustomClip | null;
};
type CallVideoReactionKind = Exclude<ConversationCallCharacterVideoClipKind, "idle" | "talking">;
type CallTtsVideoChunk = {
  text: string;
  audioText: string;
  videoKind: ConversationCallCharacterVideoClipKind;
  followKind?: "talking";
};

type ParticipantGridLayout = {
  columns: number;
  rows: number;
  density: ParticipantTileDensity;
};

const MOBILE_CALL_PICKER_TABS: ConversationMediaPickerTab[] = [
  { id: "emoji", label: "Emoji" },
  { id: "gifs", label: "GIFs" },
  { id: "stickers", label: "Stickers" },
];

const CALL_SILENCE_CHECK_MS = 150_000;
const CALL_SILENCE_POLL_MS = 10_000;
const CALL_MIC_VAD_INTERVAL_MS = 120;
const CALL_MIC_MIN_SEGMENT_MS = 420;
const CALL_MIC_SILENCE_MS = 3_000;
const CALL_MIC_MAX_SEGMENT_MS = 60_000;
const CALL_MIC_RMS_START = 0.022;
const CALL_MIC_RMS_CONTINUE = 0.013;
const CALL_MIC_CONFIRM_FRAMES = 2;
const CALL_MIC_MIN_VOICED_MS = 180;
const CALL_MIC_MIN_PEAK_RMS = 0.022;
const CALL_TTS_INTERRUPT_VOICED_MS = 600;
const CALL_TTS_INTERRUPT_TEXT_MAX_CHARS = 1200;
const CALL_TTS_MAX_REQUEST_CHARS = 3_900;
const CALL_VIDEO_LOOP_GUARD_SECONDS = 0.12;
const CALL_OPTIMISTIC_MESSAGE_RECONCILE_MS = 5 * 60 * 1000;
const CALL_MUTED_REMINDER_TIMEOUT_MS = 10_000;
const DEFAULT_TEXT_TO_VOICE_PAUSE_MS = 1_800;
const ONLINE_CHARACTER_JOIN_DELAY_MS = 1_600;
const AWAY_CHARACTER_JOIN_DELAY_MS = 10_000;
const DND_CHARACTER_JOIN_DELAY_MS = 12_000;
const CALL_COMMAND_ALIASES = new Map<string, string>([
  ["end", "end_call"],
  ["end_call", "end_call"],
  ["hang_up", "end_call"],
  ["hangup", "end_call"],
  ["leave", "leave_call"],
  ["leave_call", "leave_call"],
  ["drop", "leave_call"],
  ["disconnect", "leave_call"],
  ["sound", "soundboard"],
  ["sound_board", "soundboard"],
  ["soundboard", "soundboard"],
  ["play_clip", "play_clip"],
  ["clip", "play_clip"],
]);

const PARTICIPANT_TILE_CLASSES: Record<
  ParticipantTileDensity,
  {
    tile: string;
    avatar: string;
    fallback: string;
    name: string;
  }
> = {
  large: {
    tile: "rounded-xl p-4",
    avatar: "h-24 w-24",
    fallback: "text-2xl",
    name: "bottom-3 max-w-[calc(100%-1.5rem)] px-3 py-1 text-xs",
  },
  medium: {
    tile: "rounded-lg p-3",
    avatar: "h-20 w-20",
    fallback: "text-xl",
    name: "bottom-2.5 max-w-[calc(100%-1rem)] px-2.5 py-1 text-[0.72rem]",
  },
  small: {
    tile: "rounded-lg p-2",
    avatar: "h-14 w-14",
    fallback: "text-base",
    name: "bottom-2 max-w-[calc(100%-0.75rem)] px-2 py-0.5 text-[0.65rem]",
  },
  compact: {
    tile: "rounded-md p-1.5",
    avatar: "h-10 w-10",
    fallback: "text-sm",
    name: "bottom-1.5 max-w-[calc(100%-0.5rem)] px-1.5 py-0.5 text-[0.6rem]",
  },
};

function getParticipantGridLayout(count: number, mobile: boolean): ParticipantGridLayout {
  const safeCount = Math.max(1, count);
  const columns = mobile
    ? safeCount <= 2
      ? 1
      : Math.min(4, Math.ceil(Math.sqrt(safeCount)))
    : safeCount <= 1
      ? 1
      : safeCount === 4
        ? 2
        : Math.min(6, Math.ceil(Math.sqrt(safeCount * 1.35)));
  const rows = Math.max(1, Math.ceil(safeCount / columns));
  const density: ParticipantTileDensity =
    safeCount <= 2 ? "large" : safeCount <= 4 ? "medium" : safeCount <= 8 ? "small" : "compact";
  return { columns, rows, density };
}

function useMobileCallLayout() {
  const [mobile, setMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return mobile;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function detectCallVideoCueKind(value: string | null | undefined): CallVideoReactionKind | null {
  const searchable = value?.toLowerCase().replace(/[_-]+/g, " ") ?? "";
  if (!searchable.trim()) return null;
  if (/\b(laugh|laughs|laughing|laughter|chuckle|chuckles|chuckling|giggle|giggles|giggling)\b/.test(searchable)) {
    return "laughing";
  }
  if (/\b(cry|cries|crying|sob|sobs|sobbing|tearful|tears|weeping)\b/.test(searchable)) return "crying";
  if (/\b(angry|anger|furious|irritated|irritation|snarl|snarls|seething|growl|growls)\b/.test(searchable)) {
    return "angry";
  }
  if (
    /\b(sigh|sighs|sighing|exhale|exhales|exhaling|inhale|inhales|inhaling|deep breath|breathes? (?:in|out))\b/.test(
      searchable,
    )
  ) {
    return "sighing";
  }
  return null;
}

function splitCallTtsVideoChunkByLimit(chunk: CallTtsVideoChunk): CallTtsVideoChunk[] {
  if (chunk.audioText.length <= CALL_TTS_MAX_REQUEST_CHARS) return [chunk];
  const pieces: CallTtsVideoChunk[] = [];
  for (let start = 0; start < chunk.audioText.length; start += CALL_TTS_MAX_REQUEST_CHARS) {
    const audioText = chunk.audioText.slice(start, start + CALL_TTS_MAX_REQUEST_CHARS);
    pieces.push({
      ...chunk,
      text: audioText,
      audioText,
      followKind: undefined,
    });
  }
  return pieces;
}

function stripCallTtsCueText(text: string) {
  return text
    .replace(/\[[^\]\r\n]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyCallTtsPhoneticNames(text: string, participants: Participant[]) {
  let next = text;
  for (const participant of participants) {
    const name = participant.name.trim();
    const phoneticName = participant.phoneticName?.trim();
    if (!name || !phoneticName || name === phoneticName) continue;
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(name)})(?=$|[^\\p{L}\\p{N}_])`, "giu");
    next = next.replace(pattern, (_match, prefix: string) => `${prefix}${phoneticName}`);
  }
  return next;
}

function pushCallTtsVideoChunk(
  chunks: CallTtsVideoChunk[],
  text: string,
  videoKind: ConversationCallCharacterVideoClipKind,
  followKind?: "talking",
  participants?: Participant[],
) {
  const trimmed = text.trim();
  const audioText = participants
    ? applyCallTtsPhoneticNames(stripCallTtsCueText(trimmed), participants)
    : stripCallTtsCueText(trimmed);
  if (!trimmed || !audioText) return;
  const chunk = { text: trimmed, audioText, videoKind, followKind };
  chunks.push(...splitCallTtsVideoChunkByLimit(chunk));
}

function hasNonCueSpeech(text: string) {
  return text.replace(/\[[^\]\r\n]+\]/g, "").trim().length > 0;
}

function buildCallTtsVideoChunks(lines: string[], tone: string, participants?: Participant[]): CallTtsVideoChunk[] {
  const chunks: CallTtsVideoChunk[] = [];
  const cuePattern = /\[[^\]\r\n]+\]/g;
  let recognizedCueCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    let cursor = 0;
    let pendingCueKind: CallVideoReactionKind | null = null;
    for (const match of line.matchAll(cuePattern)) {
      const cue = match[0] ?? "";
      const cueStart = match.index ?? 0;
      const reactionKind = detectCallVideoCueKind(cue);
      if (!reactionKind) continue;

      const beforeCue = line.slice(cursor, cueStart);
      if (hasNonCueSpeech(beforeCue)) {
        pushCallTtsVideoChunk(
          chunks,
          beforeCue,
          pendingCueKind ?? "talking",
          pendingCueKind ? "talking" : undefined,
          participants,
        );
      } else {
        const beforeCueAudio = stripCallTtsCueText(beforeCue);
        if (beforeCueAudio) {
          pushCallTtsVideoChunk(
            chunks,
            beforeCue,
            pendingCueKind ?? "talking",
            pendingCueKind ? "talking" : undefined,
            participants,
          );
        }
      }
      pendingCueKind = reactionKind;
      recognizedCueCount += 1;
      cursor = cueStart + cue.length;
    }
    pushCallTtsVideoChunk(
      chunks,
      line.slice(cursor),
      pendingCueKind ?? "talking",
      pendingCueKind ? "talking" : undefined,
      participants,
    );
  }

  if (chunks.length === 0) return [];
  if (recognizedCueCount === 0) {
    const toneKind = detectCallVideoCueKind(tone);
    if (toneKind) {
      chunks[0] = { ...chunks[0], videoKind: toneKind, followKind: "talking" };
    }
  }
  return chunks;
}

function makeCallVideoCueKey(voiceKey: string, chunkIndex: number) {
  return `${voiceKey}::video:${chunkIndex}`;
}

function getSystemVoiceTypingHint() {
  if (typeof navigator === "undefined") {
    return "Manual dictation focuses the call input. Start your operating system's dictation yourself, then send.";
  }
  const platform = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
  const isAppleMobile = /iphone|ipad|ipod/.test(platform) || (platform.includes("mac") && navigator.maxTouchPoints > 1);
  if (isAppleMobile) return "The call input is focused. Tap the keyboard microphone yourself, then send.";
  if (platform.includes("android"))
    return "The call input is focused. Tap the keyboard microphone yourself, then send.";
  if (platform.includes("mac")) {
    return "The call input is focused. Start macOS Dictation yourself, then send.";
  }
  if (platform.includes("win")) return "The call input is focused. Start Windows voice typing with Win+H, then send.";
  if (platform.includes("linux")) return "The call input is focused. Start your desktop dictation yourself, then send.";
  return "Manual dictation focuses the call input. Start your operating system's dictation yourself, then send.";
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const two = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

function callStartedAtMs(session: ConversationCallSession) {
  const timestamp = Date.parse(session.startedAt ?? session.createdAt);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function characterJoinDelayMs(participant: Participant) {
  if (participant.kind !== "character") return 0;
  switch (participant.conversationStatus) {
    case "idle":
      return AWAY_CHARACTER_JOIN_DELAY_MS;
    case "dnd":
      return DND_CHARACTER_JOIN_DELAY_MS;
    case "online":
    default:
      return ONLINE_CHARACTER_JOIN_DELAY_MS;
  }
}

function getBracketCommandName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  const bracket = trimmed.match(/^\[([a-z0-9_-]+)/i);
  const normalized = (bracket?.[1] ?? trimmed)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return CALL_COMMAND_ALIASES.get(normalized) ?? normalized;
}

function getSoundboardCommandName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  const match =
    trimmed.match(/sound\s*=\s*"([^"]+)"/i) ??
    trimmed.match(/sound\s*=\s*'([^']+)'/i) ??
    trimmed.match(/sound\s*=\s*([^\]\s,]+)/i);
  return match?.[1]?.trim() ?? "";
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

function readPlayClipCommandName(value: string | null | undefined) {
  return (
    getCommandStringParam(value, "name") ||
    getCommandStringParam(value, "clip") ||
    getCommandStringParam(value, "label") ||
    getCommandRootStringValue(value)
  ).trim();
}

function normalizeClipLookupName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getReadyCallVideoClip(
  manifest: ConversationCallCharacterVideoManifest | undefined,
  kind: ConversationCallCharacterVideoClipKind,
) {
  return manifest?.clips.find((clip) => clip.kind === kind && clip.status === "ready" && clip.url) ?? null;
}

type TrimmedCallVideoClip = {
  url?: string | null;
  trimStartSeconds?: number | null;
  trimEndSeconds?: number | null;
};

function readCallVideoTrimStart(clip: TrimmedCallVideoClip | null | undefined) {
  const value = clip?.trimStartSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function readCallVideoTrimEnd(clip: TrimmedCallVideoClip | null | undefined) {
  const value = clip?.trimEndSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function seekCallVideoToTrimStart(video: HTMLVideoElement, clip: TrimmedCallVideoClip | null | undefined) {
  const start = readCallVideoTrimStart(clip);
  const end = readCallVideoTrimEnd(clip);
  if (end !== null && start >= end) return;
  if (video.currentTime + 0.03 < start || (end !== null && video.currentTime >= end)) {
    video.currentTime = start;
  }
}

function handleCallVideoTrimTimeUpdate(
  video: HTMLVideoElement,
  clip: TrimmedCallVideoClip | null | undefined,
  options: { loop: boolean; onEnded?: () => void },
) {
  const start = readCallVideoTrimStart(clip);
  if (start > 0 && video.currentTime + 0.03 < start) {
    video.currentTime = start;
    return;
  }
  const end = readCallVideoTrimEnd(clip);
  if (end === null || video.currentTime < end - 0.03) return;
  video.currentTime = start;
  if (options.loop) {
    void video.play().catch(() => undefined);
  } else {
    video.pause();
    options.onEnded?.();
  }
}

function handleCallVideoLoopFrame(video: HTMLVideoElement, clip: TrimmedCallVideoClip | null | undefined) {
  const start = readCallVideoTrimStart(clip);
  const trimEnd = readCallVideoTrimEnd(clip);
  const naturalEnd = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
  const end = trimEnd ?? naturalEnd;
  if (end === null || start >= end) return;
  const duration = end - start;
  const guard = Math.min(CALL_VIDEO_LOOP_GUARD_SECONDS, Math.max(0.025, duration * 0.08));
  if (video.currentTime >= end - guard && video.currentTime > start + guard) {
    video.currentTime = start;
    if (!video.paused) void video.play().catch(() => undefined);
  }
}

function readCallMessageAttachments(message: ConversationCallMessage): MessageAttachment[] {
  const raw = message.extra?.attachments;
  if (!Array.isArray(raw)) return [];
  return raw.filter((attachment): attachment is MessageAttachment => {
    return !!attachment && typeof attachment === "object" && typeof (attachment as MessageAttachment).type === "string";
  });
}

function readCallMessageReactions(message: ConversationCallMessage): MessageReaction[] {
  const raw = message.extra?.reactions;
  if (!Array.isArray(raw)) return [];
  return raw.filter((reaction): reaction is MessageReaction => {
    if (!reaction || typeof reaction !== "object") return false;
    const candidate = reaction as MessageReaction;
    return typeof candidate.emoji === "string" && Array.isArray(candidate.by);
  });
}

type ConversationCallCustomClipExtra = {
  characterId: string;
  clipId: string | null;
  label: string;
  prompt: string;
};

function readCallCustomClipExtra(message: ConversationCallMessage): ConversationCallCustomClipExtra | null {
  const raw = message.extra?.conversationCallCustomClip;
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const characterId = typeof record.characterId === "string" ? record.characterId : message.characterId;
  const label = typeof record.label === "string" ? record.label : "Custom clip";
  const prompt = typeof record.prompt === "string" ? record.prompt : "";
  const clipId = typeof record.clipId === "string" ? record.clipId : null;
  if (!characterId) return null;
  return { characterId, clipId, label, prompt };
}

function forceSilentCallVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  if (!video.defaultMuted) video.defaultMuted = true;
  if (!video.muted) video.muted = true;
  if (video.volume !== 0) video.volume = 0;
}

function keepCallVideoSilent(event: SyntheticEvent<HTMLVideoElement>) {
  forceSilentCallVideo(event.currentTarget);
}

function messageLabel(message: ConversationCallMessage, participants: Participant[]) {
  if (message.participantKind === "user") return participants.find((p) => p.kind === "user")?.name ?? "You";
  return participants.find((p) => p.characterId === message.characterId)?.name ?? "Character";
}

function messageContent(message: ConversationCallMessage, participants: Participant[]) {
  if (message.kind !== "command") return message.content;
  const speaker = messageLabel(message, participants);
  switch (getBracketCommandName(message.content)) {
    case "end_call":
      return `${speaker} ended the call.`;
    case "leave_call":
      return `${speaker} left the call.`;
    case "soundboard":
      return `${speaker} used the soundboard.`;
    default:
      return message.content;
  }
}

function callMessageTimestampMs(message: ConversationCallMessage) {
  const timestamp = Date.parse(message.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isSamePersistedCallMessage(
  optimisticMessage: ConversationCallMessage,
  persistedMessage: ConversationCallMessage,
) {
  if (optimisticMessage.extra?.optimistic !== true) return false;
  if (persistedMessage.extra?.optimistic === true) return false;
  if (optimisticMessage.callId !== persistedMessage.callId) return false;
  if (optimisticMessage.chatId !== persistedMessage.chatId) return false;
  if (optimisticMessage.role !== persistedMessage.role) return false;
  if (optimisticMessage.participantKind !== persistedMessage.participantKind) return false;
  if ((optimisticMessage.characterId ?? null) !== (persistedMessage.characterId ?? null)) return false;
  if (optimisticMessage.kind !== persistedMessage.kind) return false;
  if (optimisticMessage.content.trim() !== persistedMessage.content.trim()) return false;
  const optimisticAt = callMessageTimestampMs(optimisticMessage);
  const persistedAt = callMessageTimestampMs(persistedMessage);
  if (!optimisticAt || !persistedAt) return true;
  return Math.abs(persistedAt - optimisticAt) <= CALL_OPTIMISTIC_MESSAGE_RECONCILE_MS;
}

function findParticipantForTurn(turn: ConversationCallTurn, participants: Participant[]) {
  return (
    participants.find((participant) => participant.characterId && participant.characterId === turn.characterId) ??
    participants.find((participant) => participant.name === turn.speakerName) ??
    null
  );
}

function synthesizeBuiltInSound(sound: ConversationCallSound) {
  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    toast.error("This browser cannot play synthesized soundboard sounds.");
    return;
  }
  const audioContext = new AudioContextCtor();
  const gain = audioContext.createGain();
  const oscillator = audioContext.createOscillator();
  const now = audioContext.currentTime;
  const id = sound.id;
  oscillator.type = id.includes("sparkle") ? "triangle" : id.includes("pop") ? "square" : "sine";
  oscillator.frequency.setValueAtTime(id.includes("tap") ? 360 : id.includes("pop") ? 180 : 640, now);
  if (id.includes("sparkle")) oscillator.frequency.exponentialRampToValueAtTime(1180, now + 0.22);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.38);
  window.setTimeout(() => void audioContext.close(), 700);
}

function chooseRecorderMimeType(includeVideo: boolean) {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  const candidates = includeVideo
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
    : ["audio/ogg;codecs=opus", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function recorderFileName(includeVideo: boolean, mimeType: string) {
  if (mimeType.includes("mp4")) return includeVideo ? "call-video.mp4" : "call-audio.m4a";
  if (mimeType.includes("ogg")) return "call-audio.ogg";
  return includeVideo ? "call-video.webm" : "call-audio.webm";
}

function audioRmsFromTimeDomain(data: Uint8Array) {
  let sum = 0;
  for (let index = 0; index < data.length; index += 1) {
    const centered = (data[index]! - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / Math.max(1, data.length));
}

function getAudioContextCtor() {
  return (
    window.AudioContext ??
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

function mixAudioBufferToMono(buffer: AudioBuffer): Float32Array {
  const output = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < buffer.length; index += 1) {
      output[index] += data[index]! / buffer.numberOfChannels;
    }
  }
  return output;
}

function resampleAudio(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const outputLength = Math.max(1, Math.round((samples.length * toRate) / fromRate));
  const output = new Float32Array(outputLength);
  const ratio = (samples.length - 1) / Math.max(1, outputLength - 1);
  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(samples.length - 1, left + 1);
    const fraction = sourceIndex - left;
    output[index] = samples[left]! * (1 - fraction) + samples[right]! * fraction;
  }
  return output;
}

function encodePcmWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function convertRecordedAudioToWavFile(blob: Blob): Promise<File> {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    throw new Error("This browser cannot prepare recorded audio for speech input.");
  }
  const audioContext = new AudioContextCtor();
  try {
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const mono = mixAudioBufferToMono(decoded);
    const resampled = resampleAudio(mono, decoded.sampleRate, 16_000);
    const wav = encodePcmWav(resampled, 16_000);
    return new File([wav], "call-audio.wav", { type: "audio/wav" });
  } finally {
    void audioContext.close();
  }
}

function CallCustomClipPreview({ clip }: { clip: ConversationCallCustomClipExtra }) {
  const { data: manifest } = useConversationCallCharacterVideos(
    clip.characterId,
    Boolean(clip.characterId && clip.clipId),
  );
  const customClip = clip.clipId ? manifest?.customClips.find((item) => item.id === clip.clipId) : null;
  const status = customClip?.status ?? "generating";
  const title = customClip?.label ?? clip.label;
  const description = customClip?.prompt ?? clip.prompt;

  if (customClip?.status === "ready" && customClip.url) {
    return (
      <div className="mt-2 max-w-xl overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)]">
        <video
          src={customClip.url}
          controls
          controlsList="novolume"
          muted
          playsInline
          className="max-h-80 w-full bg-black object-contain"
          onLoadedMetadata={(event) => {
            keepCallVideoSilent(event);
            seekCallVideoToTrimStart(event.currentTarget, customClip);
          }}
          onPlay={(event) => {
            keepCallVideoSilent(event);
            seekCallVideoToTrimStart(event.currentTarget, customClip);
          }}
          onTimeUpdate={(event) => handleCallVideoTrimTimeUpdate(event.currentTarget, customClip, { loop: false })}
          onVolumeChange={keepCallVideoSilent}
        />
        <div className="border-t border-[var(--marinara-chat-chrome-panel-border)] px-2.5 py-2">
          <div className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">{title}</div>
          {description ? (
            <div className="mt-0.5 text-[0.6875rem] leading-snug text-[var(--marinara-chat-chrome-panel-muted)]">
              {description}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 max-w-xl rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] px-2.5 py-2 text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
      <div className="flex items-center gap-2 font-medium text-[var(--marinara-chat-chrome-panel-title)]">
        {status === "error" ? (
          <X className="h-3.5 w-3.5 text-[var(--destructive)]" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--marinara-chat-chrome-accent)]" />
        )}
        <span>{title}</span>
      </div>
      <div className="mt-1">
        {status === "error" ? (customClip?.error ?? "Custom clip generation failed.") : "Preparing custom clip..."}
      </div>
    </div>
  );
}

function CallAvatar({
  participant,
  className,
  fallbackClassName,
}: {
  participant: Participant;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full bg-[var(--secondary)] ring-1 ring-[var(--border)]",
        className,
      )}
    >
      {participant.avatarUrl ? (
        <img
          src={participant.avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          style={participant.avatarCrop ? getAvatarCropStyle(participant.avatarCrop) : undefined}
        />
      ) : (
        <span className={cn("font-semibold text-[var(--marinara-chat-chrome-panel-muted)]", fallbackClassName)}>
          {participant.name.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

function ParticipantTile({
  participant,
  active,
  cameraStream,
  density,
  characterVideoEnabled,
  automaticVideoClipGenerationEnabled,
  videoPlayback,
  onVideoEmotionEnded,
  onVideoClipReadiness,
}: {
  participant: Participant;
  active: boolean;
  cameraStream?: MediaStream | null;
  density: ParticipantTileDensity;
  characterVideoEnabled: boolean;
  automaticVideoClipGenerationEnabled: boolean;
  videoPlayback?: CharacterVideoPlaybackState;
  onVideoEmotionEnded: (participantId: string, voiceKey: string) => void;
  onVideoClipReadiness: (characterId: string, hasReadyBasicClip: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const requestedGenerationRef = useRef(false);
  const densityClasses = PARTICIPANT_TILE_CLASSES[density];
  const characterId = participant.kind === "character" ? participant.characterId : null;
  const { data: characterVideoManifest } = useConversationCallCharacterVideos(
    characterId,
    characterVideoEnabled && Boolean(characterId),
  );
  const generateCharacterVideos = useGenerateConversationCallCharacterVideos();

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (!characterVideoEnabled || !characterId || !characterVideoManifest || requestedGenerationRef.current) return;
    if (characterVideoManifest.generating) return;
    const basicClipKinds: ConversationCallCharacterVideoClipKind[] = ["idle", "talking"];
    const hasReadyBasicClip = characterVideoManifest.clips.some(
      (clip) => basicClipKinds.includes(clip.kind) && clip.status === "ready" && clip.url,
    );
    onVideoClipReadiness(characterId, hasReadyBasicClip);
    if (!automaticVideoClipGenerationEnabled) {
      return;
    }
    const missingBasicClipKinds = basicClipKinds.filter((kind) => {
      const clip = characterVideoManifest.clips.find((item) => item.kind === kind);
      return !clip || (clip.status !== "ready" && clip.status !== "generating");
    });
    if (missingBasicClipKinds.length === 0) return;
    requestedGenerationRef.current = true;
    generateCharacterVideos.mutate(
      { characterId, clipKinds: missingBasicClipKinds, clipCount: missingBasicClipKinds.length },
      {
        onError: (error) => {
          console.warn("[conversation-call] Failed to start character video generation", error);
          requestedGenerationRef.current = false;
        },
      },
    );
  }, [
    automaticVideoClipGenerationEnabled,
    characterId,
    characterVideoEnabled,
    characterVideoManifest,
    generateCharacterVideos,
    onVideoClipReadiness,
  ]);

  const customVideoClip =
    videoPlayback?.customClip?.status === "ready" && videoPlayback.customClip.url ? videoPlayback.customClip : null;
  const requestedVideoKind = customVideoClip ? "idle" : (videoPlayback?.kind ?? "idle");
  const preferredVideoClip = getReadyCallVideoClip(characterVideoManifest, requestedVideoKind);
  const fallbackVideoClip =
    requestedVideoKind !== "talking" ? getReadyCallVideoClip(characterVideoManifest, "talking") : null;
  const idleVideoClip = requestedVideoKind !== "idle" ? getReadyCallVideoClip(characterVideoManifest, "idle") : null;
  const characterVideoClip = characterVideoEnabled
    ? (customVideoClip ?? preferredVideoClip ?? fallbackVideoClip ?? idleVideoClip)
    : null;
  const characterVideoUrl = characterVideoClip?.url ?? null;
  const activeVideoKind =
    characterVideoClip === customVideoClip
      ? "custom"
      : characterVideoClip === preferredVideoClip
        ? requestedVideoKind
        : characterVideoClip === fallbackVideoClip
          ? "talking"
          : characterVideoClip
            ? "idle"
            : null;
  const videoLoops = !customVideoClip && (activeVideoKind === "idle" || activeVideoKind === "talking");
  const videoResetKey = videoLoops ? "loop" : `${videoPlayback?.voiceKey ?? "one-shot"}:${videoPlayback?.nonce ?? 0}`;
  const videoKey = [
    participant.id,
    activeVideoKind ?? "avatar",
    videoResetKey,
    customVideoClip?.id ?? "",
    characterVideoUrl ?? "",
    characterVideoClip?.trimStartSeconds ?? 0,
    characterVideoClip?.trimEndSeconds ?? "end",
  ].join(":");
  const trimEndedRef = useRef(false);
  const [readyVideoKey, setReadyVideoKey] = useState<string | null>(null);
  const videoReady = readyVideoKey === videoKey;

  useEffect(() => {
    trimEndedRef.current = false;
    setReadyVideoKey(null);
  }, [videoKey]);

  useEffect(() => {
    if (!characterVideoUrl || !videoLoops) return;
    const video = videoRef.current;
    if (!video) return;
    let animationFrame = 0;
    const tick = () => {
      handleCallVideoLoopFrame(video, characterVideoClip);
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [characterVideoClip, characterVideoUrl, videoKey, videoLoops]);

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden border bg-[var(--marinara-chat-chrome-panel-bg)]/80 transition-all",
        densityClasses.tile,
        active
          ? "border-[var(--marinara-chat-chrome-accent)] shadow-[0_0_0_2px_var(--marinara-chat-chrome-focus-ring)]"
          : "border-[var(--marinara-chat-chrome-panel-border)]",
      )}
    >
      {cameraStream ? (
        <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : characterVideoUrl ? (
        <>
          <CallAvatar
            participant={participant}
            className={cn("max-h-[55%] max-w-[55%]", densityClasses.avatar)}
            fallbackClassName={densityClasses.fallback}
          />
          <video
            key={videoKey}
            src={characterVideoUrl}
            autoPlay
            muted
            playsInline
            loop={false}
            preload="auto"
            poster={participant.avatarUrl ?? undefined}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-75",
              videoReady ? "opacity-100" : "opacity-0",
            )}
            onLoadedMetadata={(event) => {
              keepCallVideoSilent(event);
              seekCallVideoToTrimStart(event.currentTarget, characterVideoClip);
            }}
            onLoadedData={(event) => {
              keepCallVideoSilent(event);
              seekCallVideoToTrimStart(event.currentTarget, characterVideoClip);
              setReadyVideoKey(videoKey);
            }}
            onCanPlay={(event) => {
              keepCallVideoSilent(event);
              seekCallVideoToTrimStart(event.currentTarget, characterVideoClip);
              setReadyVideoKey(videoKey);
            }}
            onPlay={(event) => {
              keepCallVideoSilent(event);
              seekCallVideoToTrimStart(event.currentTarget, characterVideoClip);
            }}
            onTimeUpdate={(event) => {
              handleCallVideoTrimTimeUpdate(event.currentTarget, characterVideoClip, {
                loop: false,
                onEnded: () => {
                  if (trimEndedRef.current) return;
                  trimEndedRef.current = true;
                  if (videoPlayback?.followKind && videoPlayback.voiceKey) {
                    onVideoEmotionEnded(participant.id, videoPlayback.voiceKey);
                  }
                },
              });
            }}
            onVolumeChange={keepCallVideoSilent}
            onEnded={(event) => {
              if (videoLoops) {
                seekCallVideoToTrimStart(event.currentTarget, characterVideoClip);
                void event.currentTarget.play().catch(() => undefined);
                return;
              }
              if (trimEndedRef.current) return;
              trimEndedRef.current = true;
              if (videoPlayback?.followKind && videoPlayback.voiceKey) {
                onVideoEmotionEnded(participant.id, videoPlayback.voiceKey);
              }
            }}
          />
        </>
      ) : (
        <CallAvatar
          participant={participant}
          className={cn("max-h-[55%] max-w-[55%]", densityClasses.avatar)}
          fallbackClassName={densityClasses.fallback}
        />
      )}
      {characterVideoEnabled && participant.kind === "character" && characterVideoManifest?.generating && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-[var(--marinara-chat-chrome-panel-bg)] px-2 py-1 text-[0.6rem] font-medium text-[var(--marinara-chat-chrome-panel-muted)] shadow ring-1 ring-[var(--marinara-chat-chrome-panel-border)]">
          <Loader2 size="0.65rem" className="animate-spin" />
          Video
        </div>
      )}
      <div
        className={cn(
          "absolute truncate rounded-full bg-[var(--marinara-chat-chrome-panel-bg)] font-medium leading-tight text-[var(--marinara-chat-chrome-panel-title)] shadow ring-1 ring-[var(--marinara-chat-chrome-panel-border)]",
          densityClasses.name,
        )}
      >
        {participant.name}
      </div>
    </div>
  );
}

export function ConversationCallSurface({
  chatId,
  session,
  characterMap,
  chatCharIds,
  personaInfo,
  onEnded,
  embedded = false,
}: ConversationCallSurfaceProps) {
  const queryClient = useQueryClient();
  const { data: persistedMessages = [] } = useConversationCallMessages(session.id);
  const { data: ttsConfig } = useTTSConfig();
  const sendMessage = useSendConversationCallMessage(session.id);
  const sendIdleCheck = useSendConversationCallIdle(session.id);
  const endCall = useEndConversationCall(chatId);
  const sendMedia = useSendConversationCallMedia(session.id);
  const recordInterruption = useRecordConversationCallInterruption(session.id);
  const updateMessageExtra = useUpdateConversationCallMessageExtra(session.id);
  const { data: sounds = [] } = useConversationCallSoundboard();
  const uploadSound = useUploadConversationCallSound();
  const deleteSound = useDeleteConversationCallSound();
  const userStatus = useUIStore((state) => state.userStatus);
  const enterToSend = useUIStore((state) => state.enterToSendConvo);
  const conversationCallVoiceVolume = useUIStore((state) => state.conversationCallVoiceVolume);
  const conversationCallVoiceMuted = useUIStore((state) => state.conversationCallVoiceMuted);
  const setConversationCallVoiceVolume = useUIStore((state) => state.setConversationCallVoiceVolume);
  const setConversationCallVoiceMuted = useUIStore((state) => state.setConversationCallVoiceMuted);
  const setYoutubePlay = useAgentStore((state) => state.setYoutubePlay);
  const [draft, setDraft] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  const [voiceVolumeOpen, setVoiceVolumeOpen] = useState(false);
  const [mutedReminderVisible, setMutedReminderVisible] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  const [mobilePickerTab, setMobilePickerTab] = useState<MobileCallPickerTab>("emoji");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [browserSpeechSupported, setBrowserSpeechSupported] = useState(false);
  const [optimisticCallMessages, setOptimisticCallMessages] = useState<ConversationCallMessage[]>([]);
  const [characterVideoPlayback, setCharacterVideoPlayback] = useState<Record<string, CharacterVideoPlaybackState>>({});
  const [characterVideoReadyById, setCharacterVideoReadyById] = useState<Record<string, boolean>>({});
  const mobileCallLayout = useMobileCallLayout();
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [joinedParticipantIds, setJoinedParticipantIds] = useState<Set<string>>(() => new Set(["user"]));
  const [departedParticipantIds, setDepartedParticipantIds] = useState<Set<string>>(() => new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micVadIntervalRef = useRef<number | null>(null);
  const micSegmentRef = useRef<LiveMicSegment | null>(null);
  const micLastSpeechAtRef = useRef(0);
  const micSpeechFrameCountRef = useRef(0);
  const userSpeakingRef = useRef(false);
  const callInteractionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputBarRef = useRef<HTMLDivElement | null>(null);
  const lastUserActivityAtRef = useRef(0);
  const lastIdleCheckAtRef = useRef(0);
  const playingTurnsRef = useRef(false);
  const activeCallVoiceRef = useRef<ActiveCallVoice | null>(null);
  const interruptedVoiceKeyRef = useRef<string | null>(null);
  const userInterruptionVoicedMsRef = useRef(0);
  const voicePlaybackInterruptedRef = useRef(false);
  const callCancelledRef = useRef(session.status !== "active");
  const callPlaybackAbortRef = useRef<AbortController | null>(null);
  const participantIdsRef = useRef<Set<string>>(new Set());
  const playedStartSoundForRef = useRef<string | null>(null);
  const playedEndSoundForRef = useRef<string | null>(null);
  const playedInitialGreetingIdsRef = useRef<Set<string>>(new Set());
  const missingVideoClipsToastShownRef = useRef(false);
  const previousSessionStatusRef = useRef(session.status);
  const [queuedCallInteractions, setQueuedCallInteractions] = useState(0);
  const messages = useMemo(() => {
    if (optimisticCallMessages.length === 0) return persistedMessages;
    const byId = new Map<string, ConversationCallMessage>();
    for (const message of persistedMessages) byId.set(message.id, message);
    for (const message of optimisticCallMessages) {
      if (persistedMessages.some((persisted) => isSamePersistedCallMessage(message, persisted))) continue;
      byId.set(message.id, message);
    }
    return [...byId.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  }, [optimisticCallMessages, persistedMessages]);

  useEffect(() => {
    if (optimisticCallMessages.length === 0 || persistedMessages.length === 0) return;
    setOptimisticCallMessages((current) =>
      current.filter(
        (optimistic) => !persistedMessages.some((persisted) => isSamePersistedCallMessage(optimistic, persisted)),
      ),
    );
  }, [optimisticCallMessages.length, persistedMessages]);
  useEffect(() => {
    setCharacterVideoReadyById({});
    missingVideoClipsToastShownRef.current = false;
  }, [session.id]);
  const callAudioEnabled = ttsConfig?.callAudioEnabled === true;
  const audioInputMode = ttsConfig?.callAudioInputMode ?? "local_whisper";
  const systemVoiceInputMode = audioInputMode === "system";
  const nativeInputMode = audioInputMode === "auto";
  const localWhisperInputMode = audioInputMode === "local_whisper";
  const browserSpeechInputMode = audioInputMode === "transcribe";
  const videoControlsEnabled = ttsConfig?.callVideoInputEnabled === true && nativeInputMode;
  const characterVideoEnabled = ttsConfig?.callCharacterVideoEnabled === true;
  const automaticVideoClipGenerationEnabled = ttsConfig?.callAutomaticVideoClipsEnabled === true;
  const soundboardEnabled = true;
  const characterVoicesMuted = conversationCallVoiceMuted || conversationCallVoiceVolume <= 0;
  const characterVoicePlaybackVolume = characterVoicesMuted ? 0 : conversationCallVoiceVolume / 100;
  const characterVoiceVolumeLabel = characterVoicesMuted ? "Muted" : `${conversationCallVoiceVolume}%`;
  const callControlGridColumns = "grid-cols-7";
  const callControlButtonClass =
    "mari-chrome-control shrink-0 p-0 max-sm:aspect-square max-sm:h-auto max-sm:min-h-0 max-sm:w-full max-sm:max-w-10 max-sm:justify-self-center sm:h-11 sm:w-11";
  const callControlIconClass = "h-4 w-4";
  const browserSpeechUnavailable = browserSpeechInputMode && !browserSpeechSupported;
  const recordingWillUseLocalWhisperFallback = browserSpeechUnavailable;
  const showMissingVideoClipsToast = useCallback(() => {
    if (missingVideoClipsToastShownRef.current) return;
    missingVideoClipsToastShownRef.current = true;
    toast("No video-call clips are ready yet.", {
      description: "Open the character editor, then Sprites > Clips, to generate idle and talking clips first.",
      duration: 10_000,
    });
  }, []);
  const updateVideoClipReadiness = useCallback((characterId: string, hasReadyBasicClip: boolean) => {
    setCharacterVideoReadyById((current) =>
      current[characterId] === hasReadyBasicClip ? current : { ...current, [characterId]: hasReadyBasicClip },
    );
  }, []);

  const participants = useMemo<Participant[]>(() => {
    const user: Participant = {
      id: "user",
      name: personaInfo?.name || "You",
      phoneticName: personaInfo?.phoneticName,
      avatarUrl: personaInfo?.avatarUrl ?? null,
      avatarCrop: personaInfo?.avatarCrop,
      kind: "user",
      characterId: null,
      canSpeak: false,
    };
    const characters = chatCharIds.flatMap((id) => {
      const character = characterMap.get(id);
      if (character?.conversationStatus === "offline") return [];
      const voice = ttsConfig ? resolveTTSVoiceForSpeaker(ttsConfig, character?.name, id) : "";
      return [
        {
          id: `character:${id}`,
          name: character?.name ?? "Character",
          phoneticName: character?.phoneticName,
          avatarUrl: character?.avatarUrl ?? null,
          avatarCrop: character?.avatarCrop,
          kind: "character" as const,
          characterId: id,
          canSpeak: Boolean(ttsConfig?.enabled && voice),
          conversationStatus: character?.conversationStatus,
        },
      ];
    });
    return [user, ...characters];
  }, [characterMap, chatCharIds, personaInfo, ttsConfig]);

  const characterJoinPlan = useMemo(
    () =>
      participants
        .filter((participant) => participant.kind === "character")
        .map((participant) => ({
          id: participant.id,
          status: participant.conversationStatus,
          delayMs: characterJoinDelayMs(participant),
        })),
    [participants],
  );

  const visibleParticipants = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.kind === "user" ||
          (joinedParticipantIds.has(participant.id) && !departedParticipantIds.has(participant.id)),
      ),
    [departedParticipantIds, joinedParticipantIds, participants],
  );
  const visibleCharacterIds = useMemo(
    () =>
      visibleParticipants
        .filter((participant) => participant.kind === "character" && participant.characterId)
        .map((participant) => participant.characterId!),
    [visibleParticipants],
  );
  useEffect(() => {
    if (!characterVideoEnabled || automaticVideoClipGenerationEnabled || visibleCharacterIds.length === 0) return;
    const allReadinessKnown = visibleCharacterIds.every((characterId) =>
      Object.prototype.hasOwnProperty.call(characterVideoReadyById, characterId),
    );
    if (!allReadinessKnown) return;
    if (visibleCharacterIds.some((characterId) => characterVideoReadyById[characterId])) return;
    showMissingVideoClipsToast();
  }, [
    automaticVideoClipGenerationEnabled,
    characterVideoEnabled,
    characterVideoReadyById,
    showMissingVideoClipsToast,
    visibleCharacterIds,
  ]);
  const visibleCallMessages = useMemo(
    () =>
      messages.filter(
        (message) => message.kind !== "speech" && message.kind !== "command" && message.extra?.hiddenFromUser !== true,
      ),
    [messages],
  );
  const participantGridLayout = useMemo(
    () => getParticipantGridLayout(visibleParticipants.length, mobileCallLayout),
    [mobileCallLayout, visibleParticipants.length],
  );
  const participantGridStyle = useMemo<CSSProperties>(
    () => ({
      gridTemplateColumns: `repeat(${participantGridLayout.columns}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${participantGridLayout.rows}, minmax(0, 1fr))`,
    }),
    [participantGridLayout.columns, participantGridLayout.rows],
  );

  const pendingParticipants = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.kind === "character" &&
          !joinedParticipantIds.has(participant.id) &&
          !departedParticipantIds.has(participant.id),
      ),
    [departedParticipantIds, joinedParticipantIds, participants],
  );

  const elapsedLabel = useMemo(() => formatDuration(clockNow - callStartedAtMs(session)), [clockNow, session]);
  const stageStatusLabel = useMemo(() => {
    if (pendingParticipants.length > 0) {
      const first = pendingParticipants[0];
      return first ? `Calling ${first.name}` : "Calling";
    }
    if (userSpeaking) return "Speaking";
    if (recording) return "Listening";
    if (queuedCallInteractions > 0 || sendMessage.isPending || sendMedia.isPending || playingTurnsRef.current) {
      return "Responding";
    }
    return "Live";
  }, [
    pendingParticipants,
    queuedCallInteractions,
    recording,
    sendMedia.isPending,
    sendMessage.isPending,
    userSpeaking,
  ]);

  const setUserSpeakingState = useCallback((speaking: boolean) => {
    if (userSpeakingRef.current === speaking) return;
    userSpeakingRef.current = speaking;
    setUserSpeaking(speaking);
  }, []);

  const stopStream = useCallback((stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopLiveMicCapture = useCallback(() => {
    if (micVadIntervalRef.current !== null) {
      window.clearInterval(micVadIntervalRef.current);
      micVadIntervalRef.current = null;
    }
    micSpeechFrameCountRef.current = 0;
    setUserSpeakingState(false);
    const segment = micSegmentRef.current;
    micSegmentRef.current = null;
    mediaRecorderRef.current = null;
    if (segment && segment.recorder.state !== "inactive") {
      try {
        segment.recorder.requestData();
        segment.recorder.stop();
      } catch {
        /* ignore recorder shutdown races */
      }
    }
    stopStream(micStreamRef.current);
    micStreamRef.current = null;
    try {
      micAudioSourceRef.current?.disconnect();
    } catch {
      /* ignore audio node shutdown races */
    }
    micAudioSourceRef.current = null;
    const audioContext = micAudioContextRef.current;
    micAudioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
    try {
      speechRecognitionRef.current?.abort();
    } catch {
      /* ignore speech recognition shutdown races */
    }
    speechRecognitionRef.current = null;
    setRecording(false);
  }, [setUserSpeakingState, stopStream]);

  const cleanupLiveCallMedia = useCallback(() => {
    activeCallVoiceRef.current = null;
    userInterruptionVoicedMsRef.current = 0;
    voicePlaybackInterruptedRef.current = false;
    ttsService.stop();
    stopLiveMicCapture();
    stopStream(cameraStream);
    stopStream(screenStream);
  }, [cameraStream, screenStream, stopLiveMicCapture, stopStream]);

  useEffect(() => {
    callCancelledRef.current = session.status !== "active";
    callPlaybackAbortRef.current?.abort();
    callPlaybackAbortRef.current = session.status === "active" ? new AbortController() : null;
    if (session.status !== "active") {
      ttsService.stop();
    }
    return () => {
      callCancelledRef.current = true;
      callPlaybackAbortRef.current?.abort();
      ttsService.stop();
      callPlaybackAbortRef.current = null;
    };
  }, [session.id, session.status]);

  const playEndSoundOnce = useCallback(() => {
    if (playedEndSoundForRef.current === session.id) return;
    playedEndSoundForRef.current = session.id;
    playConversationCallEndSound();
  }, [session.id]);

  const markUserActivity = useCallback(() => {
    lastUserActivityAtRef.current = Date.now();
    lastIdleCheckAtRef.current = 0;
  }, []);

  const enqueueCallInteraction = useCallback(
    (task: () => Promise<void>, errorMessage: string, options: { quiet?: boolean } = {}) => {
      setQueuedCallInteractions((count) => count + 1);
      const queued = callInteractionQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (callCancelledRef.current) return;
          await task();
        })
        .catch((error) => {
          if (options.quiet) {
            console.warn("[conversation-call] Queued interaction failed", error);
            return;
          }
          toast.error(error instanceof Error ? error.message : errorMessage);
        })
        .finally(() => {
          setQueuedCallInteractions((count) => Math.max(0, count - 1));
        });
      callInteractionQueueRef.current = queued;
      return queued;
    },
    [],
  );

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (session.status !== "active") return;
    lastUserActivityAtRef.current = Date.now();
    lastIdleCheckAtRef.current = 0;
  }, [session.id, session.status]);

  useEffect(() => {
    if (session.status !== "active" || !callAudioEnabled) {
      setMutedReminderVisible(false);
      return;
    }
    setMutedReminderVisible(true);
    const timeout = window.setTimeout(() => setMutedReminderVisible(false), CALL_MUTED_REMINDER_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [callAudioEnabled, session.id, session.status]);

  useEffect(() => {
    if (recording) setMutedReminderVisible(false);
  }, [recording]);

  useEffect(() => {
    setDepartedParticipantIds(new Set());
    setOptimisticCallMessages([]);
    setCharacterVideoPlayback({});
  }, [session.id]);

  useEffect(() => {
    if (session.status !== "active") return;
    if (playedStartSoundForRef.current === session.id) return;
    playedStartSoundForRef.current = session.id;
    playConversationCallStartSound();
  }, [session.id, session.status]);

  useEffect(() => {
    if (previousSessionStatusRef.current === "active" && session.status === "ended") {
      playEndSoundOnce();
    }
    previousSessionStatusRef.current = session.status;
  }, [playEndSoundOnce, session.status]);

  useEffect(() => {
    const initialIds = new Set<string>(["user"]);
    if (session.initiator === "character") {
      for (const participant of characterJoinPlan) initialIds.add(participant.id);
      setJoinedParticipantIds(initialIds);
      return;
    }

    setJoinedParticipantIds(initialIds);
    const timers = characterJoinPlan.map((participant) =>
      window.setTimeout(() => {
        setJoinedParticipantIds((current) => {
          if (current.has(participant.id)) return current;
          const next = new Set(current);
          next.add(participant.id);
          return next;
        });
        playConversationCallJoinSound();
      }, participant.delayMs),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [characterJoinPlan, session.id, session.initiator]);

  useEffect(() => {
    const departedParticipantIds = messages.flatMap((message) => {
      if (message.kind !== "command") return [];
      if (getBracketCommandName(message.content) !== "leave_call") return [];
      return message.characterId ? [`character:${message.characterId}`] : [];
    });
    if (departedParticipantIds.length === 0) return;
    setDepartedParticipantIds((current) => {
      let changed = false;
      const next = new Set(current);
      for (const participantId of departedParticipantIds) {
        if (!next.has(participantId)) {
          next.add(participantId);
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setJoinedParticipantIds((current) => {
      let changed = false;
      const next = new Set(current);
      for (const participantId of departedParticipantIds) {
        if (next.delete(participantId)) changed = true;
      }
      return changed ? next : current;
    });
  }, [messages]);

  useEffect(() => {
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.participantKind === "user" && message.createdAt);
    if (!latestUserMessage) return;
    const timestamp = Date.parse(latestUserMessage.createdAt);
    if (Number.isFinite(timestamp) && timestamp > lastUserActivityAtRef.current) {
      lastUserActivityAtRef.current = timestamp;
      lastIdleCheckAtRef.current = 0;
    }
  }, [messages]);

  useEffect(() => {
    setBrowserSpeechSupported(isBrowserSpeechRecognitionSupported());
    return () => {
      cleanupLiveCallMedia();
    };
  }, [cleanupLiveCallMedia]);

  useEffect(() => {
    participantIdsRef.current = new Set(visibleParticipants.map((participant) => participant.id));
  }, [visibleParticipants]);

  useEffect(
    () =>
      ttsService.subscribe((state, activeId) => {
        setSpeakingId(state === "playing" && activeId && participantIdsRef.current.has(activeId) ? activeId : null);
      }),
    [],
  );

  useEffect(() => {
    ttsService.setCurrentPlaybackVolume(characterVoicePlaybackVolume, characterVoicesMuted);
  }, [characterVoicePlaybackVolume, characterVoicesMuted]);

  const toggleCharacterVoicesMuted = useCallback(() => {
    if (characterVoicesMuted) {
      if (conversationCallVoiceVolume <= 0) setConversationCallVoiceVolume(50);
      setConversationCallVoiceMuted(false);
      return;
    }
    setConversationCallVoiceMuted(true);
  }, [
    characterVoicesMuted,
    conversationCallVoiceVolume,
    setConversationCallVoiceMuted,
    setConversationCallVoiceVolume,
  ]);

  const setParticipantVideoTalking = useCallback(
    (participantId: string, voiceKey: string, kind: ConversationCallCharacterVideoClipKind, followKind?: "talking") => {
      setCharacterVideoPlayback((current) => ({
        ...current,
        [participantId]: {
          kind,
          followKind,
          voiceKey,
          nonce: Date.now(),
        },
      }));
    },
    [],
  );

  const setParticipantCustomVideoClip = useCallback(
    (participantId: string, voiceKey: string, clip: ConversationCallCharacterVideoCustomClip) => {
      setCharacterVideoPlayback((current) => ({
        ...current,
        [participantId]: {
          kind: "idle",
          followKind: "idle",
          voiceKey,
          nonce: Date.now(),
          customClip: clip,
        },
      }));
    },
    [],
  );

  const clearParticipantVideoTalking = useCallback((participantId: string | null | undefined, voiceKey: string) => {
    if (!participantId) return;
    setCharacterVideoPlayback((current) => {
      const existing = current[participantId];
      if (!existing || (existing.voiceKey !== voiceKey && !existing.voiceKey.startsWith(`${voiceKey}::video:`))) {
        return current;
      }
      const next = { ...current };
      delete next[participantId];
      return next;
    });
  }, []);

  const handleVideoEmotionEnded = useCallback((participantId: string, voiceKey: string) => {
    setCharacterVideoPlayback((current) => {
      const existing = current[participantId];
      if (!existing || existing.voiceKey !== voiceKey || !existing.followKind) return current;
      return {
        ...current,
        [participantId]: {
          ...existing,
          kind: existing.followKind,
          followKind: undefined,
          customClip: null,
          nonce: Date.now(),
        },
      };
    });
  }, []);

  const playSoundById = useCallback(
    async (soundId: string) => {
      if (!soundboardEnabled) return;
      const sound = sounds.find((item) => item.id === soundId);
      if (!sound) return;
      if (sound.builtIn) {
        synthesizeBuiltInSound(sound);
        return;
      }
      await new Audio(`/api/conversation-calls/soundboard/${sound.id}/file`).play().catch((error) => {
        toast.error(error instanceof Error ? error.message : "Could not play sound.");
      });
    },
    [soundboardEnabled, sounds],
  );

  const playSoundByName = useCallback(
    async (soundName: string) => {
      if (!soundboardEnabled) return;
      const normalized = soundName.trim().toLowerCase();
      if (!normalized) return;
      const sound = sounds.find((item) => item.name.trim().toLowerCase() === normalized);
      if (!sound) return;
      await playSoundById(sound.id);
    },
    [playSoundById, soundboardEnabled, sounds],
  );

  const playCustomClipByName = useCallback(
    async (turn: ConversationCallTurn) => {
      if (!characterVideoEnabled) return;
      const requestedName = readPlayClipCommandName(turn.content);
      if (!requestedName) return;
      const participant = findParticipantForTurn(turn, participants);
      const characterId = turn.characterId ?? participant?.characterId ?? null;
      if (!participant || participant.kind !== "character" || !characterId) return;
      const manifest = await queryClient.fetchQuery({
        queryKey: conversationCallKeys.characterVideos(characterId),
        queryFn: () =>
          api.get<ConversationCallCharacterVideoManifest>(`/conversation-calls/character-videos/${characterId}`),
        staleTime: 15_000,
      });
      const normalizedRequestedName = normalizeClipLookupName(requestedName);
      const customClip =
        manifest.customClips.find(
          (clip) =>
            clip.status === "ready" && clip.url && normalizeClipLookupName(clip.label) === normalizedRequestedName,
        ) ?? null;
      if (!customClip) {
        toast(`No ready custom clip named ${requestedName} for ${participant.name}.`);
        return;
      }
      setParticipantCustomVideoClip(
        participant.id,
        `${session.id}:${participant.id}:custom:${customClip.id}:${Date.now()}`,
        customClip,
      );
      const trimStart = customClip.trimStartSeconds ?? 0;
      const trimEnd = customClip.trimEndSeconds ?? 0;
      const fallbackDurationMs = Math.max(1_500, Math.min(8_000, ((trimEnd || 5) - trimStart) * 1000 || 5_000));
      await wait(fallbackDurationMs);
    },
    [characterVideoEnabled, participants, queryClient, session.id, setParticipantCustomVideoClip],
  );

  const handleCharacterLeftCall = useCallback(
    (turn: ConversationCallTurn) => {
      const participant = findParticipantForTurn(turn, participants);
      if (!participant || participant.kind !== "character") return;
      setJoinedParticipantIds((current) => {
        if (!current.has(participant.id)) return current;
        const next = new Set(current);
        next.delete(participant.id);
        return next;
      });
      setDepartedParticipantIds((current) => {
        if (current.has(participant.id)) return current;
        const next = new Set(current);
        next.add(participant.id);
        return next;
      });
      setSpeakingId((current) => (current === participant.id ? null : current));
      playConversationCallLeaveSound();
    },
    [participants],
  );

  const handleCallEndedByCharacter = useCallback(async () => {
    try {
      await endCall.mutateAsync(session.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not end the call.");
    } finally {
      cleanupLiveCallMedia();
      playEndSoundOnce();
      await wait(250);
      onEnded?.();
    }
  }, [cleanupLiveCallMedia, endCall, onEnded, playEndSoundOnce, session.id]);

  const recordCurrentVoiceInterruption = useCallback(() => {
    const activeVoice = activeCallVoiceRef.current;
    if (!activeVoice || interruptedVoiceKeyRef.current === activeVoice.key) return;
    interruptedVoiceKeyRef.current = activeVoice.key;
    voicePlaybackInterruptedRef.current = true;
    ttsService.stop();
    recordInterruption.mutate(
      {
        characterId: activeVoice.characterId,
        speakerName: activeVoice.speakerName,
        spokenText: activeVoice.spokenText.slice(0, CALL_TTS_INTERRUPT_TEXT_MAX_CHARS),
      },
      {
        onError: (error) => {
          console.warn("[conversation-call] Failed to record voice interruption", error);
        },
      },
    );
  }, [recordInterruption]);

  const updateVoiceInterruptionDetector = useCallback(
    (speechConfirmed: boolean) => {
      const activeVoice = activeCallVoiceRef.current;
      const ttsState = ttsService.getState();
      const ttsInterruptible = ttsState === "playing" || ttsState === "loading";
      if (!activeVoice || !ttsInterruptible) {
        userInterruptionVoicedMsRef.current = 0;
        return;
      }
      if (!speechConfirmed) {
        userInterruptionVoicedMsRef.current = Math.max(
          0,
          userInterruptionVoicedMsRef.current - CALL_MIC_VAD_INTERVAL_MS,
        );
        return;
      }
      userInterruptionVoicedMsRef.current += CALL_MIC_VAD_INTERVAL_MS;
      if (userInterruptionVoicedMsRef.current >= CALL_TTS_INTERRUPT_VOICED_MS) {
        recordCurrentVoiceInterruption();
      }
    },
    [recordCurrentVoiceInterruption],
  );

  const playTurns = useCallback(
    async (turns: ConversationCallTurn[]) => {
      if (callCancelledRef.current) return;
      const playbackSignal = callPlaybackAbortRef.current?.signal;
      playingTurnsRef.current = true;
      voicePlaybackInterruptedRef.current = false;
      let shouldEndCallAfterPlayback = false;
      try {
        for (let index = 0; index < turns.length; index += 1) {
          if (callCancelledRef.current || playbackSignal?.aborted) break;
          const turn = turns[index]!;
          let pauseSourceTurn = turn;
          if (turn.mode === "command") {
            const commandName = getBracketCommandName(turn.content);
            if (commandName === "soundboard") {
              await playSoundByName(getSoundboardCommandName(turn.content));
            } else if (commandName === "play_clip") {
              await playCustomClipByName(turn);
            } else if (commandName === "youtube") {
              const searchQuery = getCommandStringParam(turn.content, "query");
              if (searchQuery) {
                setYoutubePlay({ searchQuery, mood: "Conversation call music command" });
                toast(`Playing YouTube: ${searchQuery}`);
              }
            } else if (commandName === "spotify") {
              const title = getCommandStringParam(turn.content, "title");
              const artist = getCommandStringParam(turn.content, "artist");
              toast(title ? `Playing ${title}${artist ? ` - ${artist}` : ""}` : "Playing Spotify track");
            } else if (commandName === "selfie") {
              toast("Selfie generated.");
            } else if (commandName === "custom_clip") {
              const label = getCommandStringParam(turn.content, "label") || "Custom clip";
              toast(`Generating custom clip: ${label}`);
              if (turn.characterId) {
                queryClient.invalidateQueries({ queryKey: conversationCallKeys.characterVideos(turn.characterId) });
              }
            } else if (commandName === "leave_call") {
              handleCharacterLeftCall(turn);
            } else if (commandName === "end_call") {
              shouldEndCallAfterPlayback = true;
              break;
            }
          } else if (turn.mode === "voice" && ttsConfig?.enabled && turn.content.trim()) {
            const participant = findParticipantForTurn(turn, participants);
            const voice = resolveTTSVoiceForSpeaker(
              ttsConfig,
              turn.speakerName,
              turn.characterId ?? participant?.characterId,
            );
            if (voice && !characterVoicesMuted) {
              const voiceBatch = [{ turn, participant, voice }];
              let batchEndIndex = index;
              while (true) {
                const candidate = turns[batchEndIndex + 1];
                if (!candidate || candidate.mode !== "voice" || !candidate.content.trim()) break;
                const candidateParticipant = findParticipantForTurn(candidate, participants);
                const candidateVoice = resolveTTSVoiceForSpeaker(
                  ttsConfig,
                  candidate.speakerName,
                  candidate.characterId ?? candidateParticipant?.characterId,
                );
                if (!candidateVoice) break;
                voiceBatch.push({ turn: candidate, participant: candidateParticipant, voice: candidateVoice });
                batchEndIndex += 1;
              }

              const sequenceItems = voiceBatch.flatMap((item) => {
                const tone = item.turn.tone?.trim() ?? "";
                const chunks = buildCallTtsVideoChunks([item.turn.content], tone, participants);
                const participantId = item.participant?.id ?? null;
                const voiceKey = [
                  session.id,
                  participantId ?? item.turn.speakerName,
                  item.turn.id ?? item.turn.content.slice(0, 24),
                ].join(":");
                return chunks
                  .map((chunk) => ({
                    item,
                    chunk,
                    text: chunk.audioText.trim(),
                    participantId,
                    voiceKey,
                    tone,
                    spokenText: item.turn.content.trim(),
                  }))
                  .filter((chunk) => chunk.text.length > 0);
              });
              if (sequenceItems.length === 0) {
                pauseSourceTurn = turns[batchEndIndex] ?? turn;
                index = batchEndIndex;
                continue;
              }
              const speakerKeys = new Set(
                sequenceItems.map((item) => item.participantId ?? item.item.turn.speakerName),
              );
              let activeVideoParticipantId: string | null = null;
              let activeVideoVoiceKey: string | null = null;
              try {
                await ttsService.speakSequence(
                  sequenceItems.map(({ item, text, tone, participantId }) => ({
                    text,
                    speaker: item.turn.speakerName,
                    tone: tone || undefined,
                    voice: item.voice,
                    activeId: participantId,
                  })),
                  participant?.id ?? `${session.id}:${turn.id ?? turn.content.slice(0, 12)}`,
                  {
                    signal: playbackSignal,
                    progressive: speakerKeys.size > 1 ? false : ttsConfig.progressivePlayback,
                    volume: characterVoicePlaybackVolume,
                    muted: characterVoicesMuted,
                    onChunkStart: (_request, chunkIndex) => {
                      const meta = sequenceItems[chunkIndex];
                      if (!meta) return;
                      activeCallVoiceRef.current = {
                        key: meta.voiceKey,
                        characterId: meta.item.participant?.characterId ?? meta.item.turn.characterId ?? null,
                        speakerName: meta.item.turn.speakerName,
                        spokenText: meta.spokenText,
                      };
                      userInterruptionVoicedMsRef.current = 0;
                      if (!characterVideoEnabled || !meta.participantId) return;
                      if (
                        activeVideoParticipantId &&
                        activeVideoVoiceKey &&
                        (activeVideoParticipantId !== meta.participantId || activeVideoVoiceKey !== meta.voiceKey)
                      ) {
                        clearParticipantVideoTalking(activeVideoParticipantId, activeVideoVoiceKey);
                      }
                      activeVideoParticipantId = meta.participantId;
                      activeVideoVoiceKey = meta.voiceKey;
                      setParticipantVideoTalking(
                        meta.participantId,
                        makeCallVideoCueKey(meta.voiceKey, chunkIndex),
                        meta.chunk.videoKind,
                        meta.chunk.followKind,
                      );
                    },
                    onChunkEnd: (_request, chunkIndex) => {
                      const meta = sequenceItems[chunkIndex];
                      if (!meta) return;
                      if (activeCallVoiceRef.current?.key === meta.voiceKey) {
                        activeCallVoiceRef.current = null;
                        userInterruptionVoicedMsRef.current = 0;
                      }
                    },
                  },
                );
              } finally {
                activeCallVoiceRef.current = null;
                userInterruptionVoicedMsRef.current = 0;
                const clearedVideoKeys = new Set<string>();
                for (const meta of sequenceItems) {
                  if (!meta.participantId) continue;
                  const key = `${meta.participantId}:${meta.voiceKey}`;
                  if (clearedVideoKeys.has(key)) continue;
                  clearedVideoKeys.add(key);
                  clearParticipantVideoTalking(meta.participantId, meta.voiceKey);
                }
              }
              pauseSourceTurn = turns[batchEndIndex] ?? turn;
              index = batchEndIndex;
              if (voicePlaybackInterruptedRef.current) break;
            }
          }
          if (callCancelledRef.current || playbackSignal?.aborted) break;
          const nextTurn = turns[index + 1];
          const pauseMs =
            pauseSourceTurn.mode === "text" && nextTurn?.mode === "voice" ? DEFAULT_TEXT_TO_VOICE_PAUSE_MS : 0;
          if (nextTurn && pauseMs > 0 && !callCancelledRef.current && !playbackSignal?.aborted) await wait(pauseMs);
        }
      } finally {
        activeCallVoiceRef.current = null;
        userInterruptionVoicedMsRef.current = 0;
        playingTurnsRef.current = false;
      }
      if (shouldEndCallAfterPlayback && !callCancelledRef.current && !playbackSignal?.aborted) {
        await handleCallEndedByCharacter();
      }
    },
    [
      characterVideoEnabled,
      characterVoicePlaybackVolume,
      characterVoicesMuted,
      clearParticipantVideoTalking,
      handleCallEndedByCharacter,
      handleCharacterLeftCall,
      participants,
      playCustomClipByName,
      playSoundByName,
      queryClient,
      session.id,
      setParticipantVideoTalking,
      setYoutubePlay,
      ttsConfig,
    ],
  );

  useEffect(() => {
    if (session.status !== "active") return;
    const greeting = messages.find(
      (message) =>
        message.extra?.conversationCallInitialGreeting === true &&
        message.extra?.conversationCallInitialGreetingPlayed !== true &&
        !playedInitialGreetingIdsRef.current.has(message.id),
    );
    if (!greeting) return;
    if (greeting.kind === "speech" && !ttsConfig) return;

    const rawTurn = greeting.extra?.turn;
    const turnRecord = rawTurn && typeof rawTurn === "object" ? (rawTurn as Partial<ConversationCallTurn>) : {};
    const mode =
      turnRecord.mode === "voice" || turnRecord.mode === "text" || turnRecord.mode === "command"
        ? turnRecord.mode
        : greeting.kind === "speech"
          ? "voice"
          : "text";
    const turn: ConversationCallTurn = {
      id: greeting.id,
      speakerName:
        typeof turnRecord.speakerName === "string" && turnRecord.speakerName.trim()
          ? turnRecord.speakerName
          : messageLabel(greeting, participants),
      characterId: greeting.characterId,
      mode,
      content:
        typeof turnRecord.content === "string" && turnRecord.content.trim() ? turnRecord.content : greeting.content,
      tone: typeof turnRecord.tone === "string" ? turnRecord.tone : null,
    };

    playedInitialGreetingIdsRef.current.add(greeting.id);
    void enqueueCallInteraction(
      async () => {
        await playTurns([turn]);
        await updateMessageExtra.mutateAsync({
          messageId: greeting.id,
          extra: {
            conversationCallInitialGreetingPlayed: true,
            conversationCallAutoplay: false,
          },
        });
      },
      "Could not play the call greeting.",
      { quiet: true },
    );
  }, [enqueueCallInteraction, messages, participants, playTurns, session.status, ttsConfig, updateMessageExtra]);

  const resizeDraftTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  const submitText = useCallback(
    async (content: string, inputMode: "typed" | "speech" = "typed") => {
      const text = content.trim();
      if (!text) return;
      markUserActivity();
      const optimisticMessageId =
        inputMode === "typed" ? `__optimistic_call_${session.id}_${generateClientId()}` : null;
      if (inputMode === "typed") {
        const optimisticMessage: ConversationCallMessage = {
          id: optimisticMessageId!,
          callId: session.id,
          chatId,
          role: "user",
          characterId: null,
          participantKind: "user",
          kind: "text",
          content: text,
          extra: { optimistic: true },
          createdAt: new Date().toISOString(),
        };
        setOptimisticCallMessages((current) => [...current, optimisticMessage]);
        setDraft("");
        window.requestAnimationFrame(resizeDraftTextarea);
      }
      await enqueueCallInteraction(
        async () => {
          try {
            const response = await sendMessage.mutateAsync({ content: text, inputMode });
            if (optimisticMessageId) {
              setOptimisticCallMessages((current) => current.filter((message) => message.id !== optimisticMessageId));
            }
            await playTurns(response.turns);
          } catch (error) {
            if (optimisticMessageId) {
              setOptimisticCallMessages((current) => current.filter((message) => message.id !== optimisticMessageId));
              setDraft((current) => (current.trim() ? current : text));
              window.requestAnimationFrame(resizeDraftTextarea);
            }
            throw error;
          }
        },
        inputMode === "speech" ? "Call speech transcription failed." : "Call message failed.",
      );
    },
    [chatId, enqueueCallInteraction, markUserActivity, playTurns, resizeDraftTextarea, sendMessage, session.id],
  );

  const handleDraftChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setDraft(event.currentTarget.value);
      window.requestAnimationFrame(resizeDraftTextarea);
    },
    [resizeDraftTextarea],
  );

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? draft.length;
      const end = textarea?.selectionEnd ?? draft.length;
      const nextDraft = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
      setDraft(nextDraft);
      window.requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        const cursor = start + emoji.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursor, cursor);
        resizeDraftTextarea();
      });
    },
    [draft, resizeDraftTextarea],
  );

  const handleGifSelect = useCallback(
    (gifUrl: string) => {
      setMobilePickerOpen(false);
      void submitText(gifUrl, "typed").catch((error) =>
        toast.error(error instanceof Error ? error.message : "Call GIF message failed."),
      );
    },
    [submitText],
  );

  const handleStickerSelect = useCallback(
    (name: string) => {
      setMobilePickerOpen(false);
      void submitText(`sticker:${name}:`, "typed").catch((error) =>
        toast.error(error instanceof Error ? error.message : "Call sticker message failed."),
      );
    },
    [submitText],
  );

  const submitDraft = useCallback(() => {
    void submitText(draft, "typed").catch((error) =>
      toast.error(error instanceof Error ? error.message : "Call message failed."),
    );
  }, [draft, submitText]);

  const handleDraftKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const shouldSend = enterToSend
        ? event.key === "Enter" && !event.shiftKey
        : event.key === "Enter" && (event.metaKey || event.ctrlKey);
      if (!shouldSend) return;
      event.preventDefault();
      submitDraft();
    },
    [enterToSend, submitDraft],
  );

  const startSystemVoiceTyping = useCallback(() => {
    if (!callAudioEnabled) {
      toast.warning("Call audio is disabled in Chat Settings.");
      return;
    }
    markUserActivity();
    if (mobileCallLayout) setMobileChatOpen(true);
    window.setTimeout(
      () => {
        textareaRef.current?.focus();
        resizeDraftTextarea();
      },
      mobileCallLayout ? 80 : 0,
    );
    toast.info(getSystemVoiceTypingHint());
  }, [callAudioEnabled, markUserActivity, mobileCallLayout, resizeDraftTextarea]);

  useEffect(() => {
    if (session.status !== "active") return;
    const interval = window.setInterval(() => {
      if (userStatus !== "active") return;
      if (document.visibilityState === "hidden") return;
      if (
        queuedCallInteractions > 0 ||
        sendMessage.isPending ||
        sendMedia.isPending ||
        sendIdleCheck.isPending ||
        playingTurnsRef.current
      ) {
        return;
      }
      const now = Date.now();
      const quietMs = now - lastUserActivityAtRef.current;
      if (quietMs < CALL_SILENCE_CHECK_MS) return;
      if (now - lastIdleCheckAtRef.current < CALL_SILENCE_CHECK_MS) return;
      lastIdleCheckAtRef.current = now;
      void enqueueCallInteraction(
        async () => {
          const response = await sendIdleCheck.mutateAsync({ quietMs });
          await playTurns(response.turns);
        },
        "Call idle check failed.",
        { quiet: true },
      );
    }, CALL_SILENCE_POLL_MS);
    return () => window.clearInterval(interval);
  }, [
    enqueueCallInteraction,
    playTurns,
    queuedCallInteractions,
    sendIdleCheck,
    sendMedia.isPending,
    sendMessage.isPending,
    session.status,
    userStatus,
  ]);

  const toggleCamera = useCallback(async () => {
    if (!videoControlsEnabled) {
      toast.warning("Camera input is disabled in Chat Settings.");
      return;
    }
    if (cameraStream) {
      stopStream(cameraStream);
      setCameraStream(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCameraStream(stream);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not turn on camera.");
    }
  }, [cameraStream, stopStream, videoControlsEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (!videoControlsEnabled) {
      toast.warning("Screen input is disabled in Chat Settings.");
      return;
    }
    if (screenStream) {
      stopStream(screenStream);
      setScreenStream(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      stream.getVideoTracks()[0]?.addEventListener("ended", () => setScreenStream(null), { once: true });
      setScreenStream(stream);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not share screen.");
    }
  }, [screenStream, stopStream, videoControlsEnabled]);

  const stopRecording = useCallback(() => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      return;
    }
    stopLiveMicCapture();
  }, [stopLiveMicCapture]);

  const startBrowserSpeechRecognition = useCallback(() => {
    if (recording) return;
    if (!callAudioEnabled) {
      toast.warning("Call audio is disabled in Chat Settings.");
      return;
    }
    const Recognition = getBrowserSpeechRecognitionCtor();
    if (!Recognition) {
      toast.error(
        "Browser speech recognition is not supported in this browser. You can type in the call chat instead.",
      );
      return;
    }
    markUserActivity();
    const recognition = new Recognition();
    let finalTranscript = "";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index] ?? event.results.item(index);
        const transcript = readBrowserSpeechRecognitionTranscript(result);
        if (result?.isFinal && transcript.trim()) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        }
      }
    };
    recognition.onerror = (event) => {
      const error = event.error ?? "unknown";
      setRecording(false);
      speechRecognitionRef.current = null;
      if (!["aborted", "no-speech"].includes(error)) {
        toast.error(`Speech recognition failed: ${error}`);
      }
    };
    recognition.onend = () => {
      speechRecognitionRef.current = null;
      setRecording(false);
      if (finalTranscript.trim()) {
        void submitText(finalTranscript.trim(), "speech");
      } else {
        toast.warning("No speech transcript was returned. You can type in the call chat instead.");
      }
    };
    speechRecognitionRef.current = recognition;
    setRecording(true);
    try {
      recognition.start();
    } catch (error) {
      speechRecognitionRef.current = null;
      setRecording(false);
      toast.error(error instanceof Error ? error.message : "Could not start browser speech recognition.");
    }
  }, [callAudioEnabled, markUserActivity, recording, submitText]);

  const submitRecordedCallMedia = useCallback(
    async (blob: Blob, includeVideo: boolean) => {
      const shouldUseLocalWhisper = !includeVideo && (localWhisperInputMode || recordingWillUseLocalWhisperFallback);
      if (shouldUseLocalWhisper) {
        const file = await convertRecordedAudioToWavFile(blob);
        const result = await sendMedia.mutateAsync({
          file,
          kind: "audio",
          nativePreferred: false,
          transcriptionMode: "local_whisper",
        });
        await playTurns(result.turns);
        return;
      }

      const file =
        !includeVideo && nativeInputMode
          ? await convertRecordedAudioToWavFile(blob)
          : new File([blob], recorderFileName(includeVideo, blob.type), {
              type: blob.type || (includeVideo ? "video/webm" : "audio/webm"),
            });
      const result = await sendMedia.mutateAsync({
        file,
        kind: includeVideo ? "video" : "audio",
        nativePreferred: nativeInputMode,
      });
      await playTurns(result.turns);
    },
    [localWhisperInputMode, nativeInputMode, playTurns, recordingWillUseLocalWhisperFallback, sendMedia],
  );

  const enqueueRecordedCallMedia = useCallback(
    (blob: Blob, includeVideo: boolean) => {
      void enqueueCallInteraction(
        () => submitRecordedCallMedia(blob, includeVideo),
        "Call speech transcription failed.",
      );
    },
    [enqueueCallInteraction, submitRecordedCallMedia],
  );

  const startRecording = useCallback(async () => {
    if (recording) return;
    if (!callAudioEnabled) {
      toast.warning("Call audio is disabled in Chat Settings.");
      return;
    }
    if (systemVoiceInputMode) {
      startSystemVoiceTyping();
      return;
    }
    markUserActivity();
    if (browserSpeechInputMode && browserSpeechSupported) {
      startBrowserSpeechRecognition();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone access requires HTTPS, localhost, or a browser with media device support.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      toast.error("This browser cannot record microphone audio for calls.");
      return;
    }
    if (recordingWillUseLocalWhisperFallback) {
      toast.info("Browser speech recognition is unavailable here, so Marinara will use Local Whisper instead.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      micStreamRef.current = stream;
      const videoTrack =
        nativeInputMode && videoControlsEnabled ? (screenStream ?? cameraStream)?.getVideoTracks()[0] : undefined;
      const includeVideo = Boolean(videoTrack);
      const recordingStream = includeVideo ? new MediaStream([...stream.getAudioTracks(), videoTrack!]) : stream;
      const preferredMimeType = chooseRecorderMimeType(includeVideo);
      const AudioContextCtor = getAudioContextCtor();
      if (!AudioContextCtor) {
        stopStream(stream);
        micStreamRef.current = null;
        toast.error("This browser cannot inspect microphone audio for call transcription.");
        return;
      }
      const audioContext = new AudioContextCtor();
      micAudioContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume().catch(() => undefined);
      }
      const source = audioContext.createMediaStreamSource(stream);
      micAudioSourceRef.current = source;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.15;
      source.connect(analyser);
      const timeDomain = new Uint8Array(analyser.fftSize);

      const stopSegment = () => {
        const segment = micSegmentRef.current;
        if (!segment) return;
        micSegmentRef.current = null;
        mediaRecorderRef.current = null;
        if (segment.recorder.state === "inactive") return;
        try {
          segment.recorder.requestData();
          segment.recorder.stop();
        } catch {
          /* ignore recorder shutdown races */
        }
      };

      const startSegment = (initialRms: number) => {
        if (micSegmentRef.current) return;
        const recorder = new MediaRecorder(
          recordingStream,
          preferredMimeType ? { mimeType: preferredMimeType } : undefined,
        );
        const segment: LiveMicSegment = {
          recorder,
          chunks: [],
          startedAt: Date.now(),
          includeVideo,
          voicedMs: CALL_MIC_VAD_INTERVAL_MS,
          peakRms: initialRms,
        };
        micSegmentRef.current = segment;
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) segment.chunks.push(event.data);
        };
        recorder.onstop = () => {
          if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
          if (micSegmentRef.current === segment) micSegmentRef.current = null;
          const durationMs = Date.now() - segment.startedAt;
          if (
            durationMs < CALL_MIC_MIN_SEGMENT_MS ||
            segment.voicedMs < CALL_MIC_MIN_VOICED_MS ||
            segment.peakRms < CALL_MIC_MIN_PEAK_RMS ||
            segment.chunks.length === 0
          ) {
            return;
          }
          const blob = new Blob(segment.chunks, {
            type: recorder.mimeType || (segment.includeVideo ? "video/webm" : "audio/webm"),
          });
          enqueueRecordedCallMedia(blob, segment.includeVideo);
        };
        recorder.start(500);
      };

      micLastSpeechAtRef.current = 0;
      micSpeechFrameCountRef.current = 0;
      micVadIntervalRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(timeDomain);
        const rms = audioRmsFromTimeDomain(timeDomain);
        const now = Date.now();
        const segment = micSegmentRef.current;
        const speaking = rms >= (segment ? CALL_MIC_RMS_CONTINUE : CALL_MIC_RMS_START);
        if (speaking) {
          micSpeechFrameCountRef.current += 1;
        } else if (!segment) {
          micSpeechFrameCountRef.current = 0;
        }
        const speechConfirmed = segment ? speaking : micSpeechFrameCountRef.current >= CALL_MIC_CONFIRM_FRAMES;
        setUserSpeakingState(speechConfirmed);
        updateVoiceInterruptionDetector(speechConfirmed);

        if (segment && now - segment.startedAt >= CALL_MIC_MAX_SEGMENT_MS) {
          stopSegment();
          if (speaking) {
            micLastSpeechAtRef.current = now;
            micSpeechFrameCountRef.current = CALL_MIC_CONFIRM_FRAMES;
            startSegment(rms);
          }
          return;
        }

        if (segment && speaking) {
          segment.voicedMs += CALL_MIC_VAD_INTERVAL_MS;
          segment.peakRms = Math.max(segment.peakRms, rms);
          markUserActivity();
          micLastSpeechAtRef.current = now;
          return;
        }

        if (!segment && speaking) {
          markUserActivity();
          micLastSpeechAtRef.current = now;
          startSegment(rms);
          return;
        }

        if (segment && now - micLastSpeechAtRef.current >= CALL_MIC_SILENCE_MS) {
          micSpeechFrameCountRef.current = 0;
          stopSegment();
        }
      }, CALL_MIC_VAD_INTERVAL_MS);
      setRecording(true);
    } catch (error) {
      stopLiveMicCapture();
      setUserSpeakingState(false);
      setRecording(false);
      toast.error(error instanceof Error ? error.message : "Could not start microphone.");
    }
  }, [
    callAudioEnabled,
    browserSpeechSupported,
    browserSpeechInputMode,
    cameraStream,
    enqueueRecordedCallMedia,
    markUserActivity,
    nativeInputMode,
    recording,
    recordingWillUseLocalWhisperFallback,
    screenStream,
    setUserSpeakingState,
    startBrowserSpeechRecognition,
    startSystemVoiceTyping,
    stopLiveMicCapture,
    stopStream,
    systemVoiceInputMode,
    updateVoiceInterruptionDetector,
    videoControlsEnabled,
  ]);

  const playSound = useCallback((sound: ConversationCallSound) => {
    if (sound.builtIn) {
      synthesizeBuiltInSound(sound);
      return;
    }
    const audio = new Audio(`/api/conversation-calls/soundboard/${sound.id}/file`);
    void audio.play().catch((error) => toast.error(error instanceof Error ? error.message : "Could not play sound."));
  }, []);

  const handleEnd = useCallback(async () => {
    callCancelledRef.current = true;
    callPlaybackAbortRef.current?.abort();
    cleanupLiveCallMedia();
    playEndSoundOnce();
    try {
      await endCall.mutateAsync(session.id);
      onEnded?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not end the call.");
    }
  }, [cleanupLiveCallMedia, endCall, onEnded, playEndSoundOnce, session.id]);

  const resolveCallReactorName = useCallback(
    (reactorId: string) => {
      if (reactorId === USER_REACTOR) return personaInfo?.name || "You";
      return (
        characterMap.get(reactorId)?.name ??
        participants.find((participant) => participant.characterId === reactorId)?.name ??
        "Someone"
      );
    },
    [characterMap, participants, personaInfo?.name],
  );

  const applyCallMessageReactions = useCallback(
    async (message: ConversationCallMessage, buildNext: (current: MessageReaction[]) => MessageReaction[]) => {
      const key = conversationCallKeys.messages(session.id);
      const previous = queryClient.getQueryData<ConversationCallMessage[]>(key);
      const cachedMessage = previous?.find((item) => item.id === message.id) ?? message;
      const next = buildNext(readCallMessageReactions(cachedMessage));
      queryClient.setQueryData<ConversationCallMessage[]>(key, (existing = []) =>
        existing.map((item) =>
          item.id === message.id ? { ...item, extra: { ...item.extra, reactions: next } } : item,
        ),
      );
      try {
        await updateMessageExtra.mutateAsync({ messageId: message.id, extra: { reactions: next } });
      } catch (error) {
        queryClient.setQueryData(key, previous);
        toast.error(error instanceof Error ? error.message : "Failed to update reaction.");
      } finally {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [queryClient, session.id, updateMessageExtra],
  );

  const handlePickCallReaction = useCallback(
    (message: ConversationCallMessage, emoji: string, imageUrl: string | null) => {
      void applyCallMessageReactions(message, (current) => toggleReaction(current, emoji, USER_REACTOR, imageUrl));
    },
    [applyCallMessageReactions],
  );

  const handleToggleCallReactionEntry = useCallback(
    (message: ConversationCallMessage, reaction: MessageReaction) => {
      void applyCallMessageReactions(message, (current) =>
        toggleReaction(current, reaction.emoji, USER_REACTOR, reaction.imageUrl ?? null),
      );
    },
    [applyCallMessageReactions],
  );

  const renderCallMessages = () =>
    visibleCallMessages.length === 0 ? (
      <div className="py-8 text-center text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
        No call messages yet.
      </div>
    ) : (
      <div className="space-y-3">
        {visibleCallMessages.map((message) => {
          const participant =
            message.participantKind === "user"
              ? participants.find((p) => p.kind === "user")
              : participants.find((p) => p.characterId === message.characterId);
          const attachments = readCallMessageAttachments(message);
          const customClip = readCallCustomClipExtra(message);
          const reactions = readCallMessageReactions(message);
          const canReact = message.extra?.optimistic !== true && (message.kind === "text" || message.kind === "system");
          return (
            <div key={message.id} className="group/call-message flex gap-2">
              {participant ? (
                <CallAvatar participant={participant} className="mt-0.5 h-7 w-7 shrink-0" />
              ) : (
                <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-[var(--secondary)]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                      {messageLabel(message, participants)}
                    </span>
                    <span className="shrink-0 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                      {formatTime(message.createdAt)}
                    </span>
                  </div>
                  {canReact ? (
                    <ReactionAddButton
                      onPick={(emoji, imageUrl) => handlePickCallReaction(message, emoji, imageUrl)}
                      className="shrink-0 text-[var(--marinara-chat-chrome-panel-muted)] opacity-100 hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] sm:opacity-0 sm:group-hover/call-message:opacity-100"
                    />
                  ) : null}
                </div>
                <p
                  className={cn(
                    "whitespace-pre-wrap text-sm leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]",
                    message.kind === "command" && "text-[var(--marinara-chat-chrome-panel-muted)]",
                  )}
                >
                  {messageContent(message, participants)}
                </p>
                {customClip ? <CallCustomClipPreview clip={customClip} /> : null}
                {attachments.length > 0 ? (
                  <div className="mt-2 flex flex-col items-start gap-2">
                    {attachments.map((attachment, index) =>
                      attachment.type === "image" || attachment.type.startsWith("image/") ? (
                        <button
                          key={`${message.id}:${index}`}
                          type="button"
                          onClick={() => {
                            const url = attachment.url || attachment.data;
                            if (url) window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          className="block cursor-zoom-in rounded-lg text-left"
                          title="Open image"
                        >
                          <img
                            src={attachment.url || attachment.data}
                            alt={attachment.filename || attachment.name || "Call image"}
                            className="max-h-72 max-w-full rounded-lg"
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <div
                          key={`${message.id}:${index}`}
                          className="max-w-full truncate rounded-lg bg-[var(--marinara-chat-chrome-panel-bg)] px-2.5 py-1.5 text-xs text-[var(--marinara-chat-chrome-panel-muted)] ring-1 ring-[var(--marinara-chat-chrome-panel-border)]"
                        >
                          {attachment.filename || attachment.name || "attachment"}
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
                {reactions.length > 0 ? (
                  <div className="mt-2">
                    <MessageReactions
                      reactions={reactions}
                      resolveReactorName={resolveCallReactorName}
                      onToggle={(reaction) => handleToggleCallReactionEntry(message, reaction)}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );

  const renderCallComposer = () => (
    <form
      className="relative border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--background)] p-2 sm:p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitDraft();
      }}
    >
      {mobilePickerOpen && (
        <ConversationMediaPickerPanel
          tabs={MOBILE_CALL_PICKER_TABS}
          activeTab={mobilePickerTab}
          onActiveTabChange={(tab) => {
            if (tab !== "tools") setMobilePickerTab(tab);
          }}
          onClose={() => setMobilePickerOpen(false)}
          onEmojiSelect={handleEmojiSelect}
          onGifSelect={handleGifSelect}
          onStickerSelect={handleStickerSelect}
          className="absolute bottom-full left-2 right-2 z-30 mb-3 sm:hidden"
        />
      )}
      <div
        ref={inputBarRef}
        className={getChatInputShellClass({
          hasContent: draft.trim().length > 0,
          layout: "conversation",
          className: "w-full",
        })}
      >
        <button
          type="button"
          disabled
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all sm:h-8 sm:w-8"
          title="Call file attachments are not available yet"
        >
          <Paperclip size="1rem" />
        </button>
        <QuickConnectionSwitcher className="h-9 w-9 shrink-0 rounded-xl sm:h-8 sm:w-8" />
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleDraftChange}
          onKeyDown={handleDraftKeyDown}
          onFocus={() => {
            if (mobilePickerOpen) setMobilePickerOpen(false);
          }}
          placeholder="Message in call"
          rows={1}
          className="mari-chat-input-textarea max-h-[12.5rem] min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[1rem] leading-tight text-foreground outline-none placeholder:text-foreground/30 sm:min-h-0 sm:px-0 sm:py-0 sm:leading-normal"
        />
        <button
          type="button"
          onClick={() => {
            const nextOpen = !mobilePickerOpen;
            setMobilePickerOpen(nextOpen);
            if (nextOpen) textareaRef.current?.blur();
            else textareaRef.current?.focus();
          }}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-colors sm:hidden",
            mobilePickerOpen
              ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
              : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
          )}
          title={mobilePickerOpen ? "Show keyboard" : "Emoji, GIFs & stickers"}
          aria-label={mobilePickerOpen ? "Show keyboard" : "Emoji, GIFs and stickers"}
        >
          {mobilePickerOpen ? <Keyboard size="1.25rem" /> : <Smile size="1.25rem" />}
        </button>
        <div className="relative hidden shrink-0 sm:block">
          <button
            type="button"
            onClick={() => {
              setMobilePickerOpen((value) => !value);
            }}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors sm:h-8 sm:w-8 sm:rounded-full",
              mobilePickerOpen
                ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
                : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
            )}
            title="Emoji, GIFs & stickers"
            aria-label="Emoji, GIFs and stickers"
            aria-expanded={mobilePickerOpen}
          >
            <Smile size="1.25rem" />
          </button>
          {mobilePickerOpen && (
            <ConversationMediaPickerPanel
              tabs={MOBILE_CALL_PICKER_TABS}
              activeTab={mobilePickerTab}
              onActiveTabChange={(tab) => {
                if (tab !== "tools") setMobilePickerTab(tab);
              }}
              onClose={() => setMobilePickerOpen(false)}
              onEmojiSelect={handleEmojiSelect}
              onGifSelect={handleGifSelect}
              onStickerSelect={handleStickerSelect}
              className="absolute bottom-full right-0 z-30 mb-4 w-[min(24rem,calc(100vw-1.5rem))]"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={!draft.trim()}
          className="mari-chat-send-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 disabled:cursor-not-allowed sm:h-8 sm:w-8"
          title="Send"
        >
          <Send size="0.9375rem" />
        </button>
      </div>
    </form>
  );

  return (
    <div
      className={cn(
        "mari-chrome-token-scope relative flex flex-1 flex-col overflow-hidden bg-[var(--background)] text-[var(--marinara-chat-chrome-panel-text)]",
        !embedded && "mari-chat-area mari-card-css",
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex min-h-[18rem] flex-[1_1_0] flex-col overflow-hidden border-b border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--background)] md:min-h-0 md:basis-1/2">
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="font-semibold tabular-nums text-[var(--marinara-chat-chrome-panel-title)]">
                {elapsedLabel}
              </div>
              <div className="truncate text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
                Started {formatTime(session.startedAt ?? session.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
              <Volume2 size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-hover)]" />
              <span>{stageStatusLabel}</span>
            </div>
          </div>

          <div
            className="grid min-h-0 flex-1 gap-2 overflow-hidden px-3 pb-20 pt-2 sm:gap-3 sm:px-4 sm:pb-24"
            style={participantGridStyle}
          >
            {visibleParticipants.map((participant) => (
              <ParticipantTile
                key={participant.id}
                participant={participant}
                active={speakingId === participant.id || (participant.kind === "user" && userSpeaking)}
                cameraStream={participant.kind === "user" ? cameraStream : null}
                density={participantGridLayout.density}
                characterVideoEnabled={characterVideoEnabled}
                automaticVideoClipGenerationEnabled={automaticVideoClipGenerationEnabled}
                videoPlayback={characterVideoPlayback[participant.id]}
                onVideoEmotionEnded={handleVideoEmotionEnded}
                onVideoClipReadiness={updateVideoClipReadiness}
              />
            ))}
          </div>

          {pendingParticipants.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center px-4">
              <div className="rounded-full border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-1 text-xs text-[var(--marinara-chat-chrome-panel-muted)] shadow-sm">
                {stageStatusLabel}...
              </div>
            </div>
          )}

          {mutedReminderVisible && !recording ? (
            <div
              className="absolute inset-x-3 bottom-24 z-30 mx-auto rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-2.5 pr-8 text-left text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-title)] shadow-xl shadow-black/25 sm:hidden"
              role="status"
            >
              <button
                type="button"
                onClick={() => setMutedReminderVisible(false)}
                className="absolute right-1.5 top-1.5 rounded-md p-1 text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
                aria-label="Dismiss muted reminder"
              >
                <X size="0.75rem" />
              </button>
              You are muted! Remember to unmute yourself first if you want to talk.
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-3">
            <div className="pointer-events-auto relative max-w-[calc(100vw-1.5rem)]">
              {soundboardEnabled && soundboardOpen && (
                <div className="absolute bottom-full left-1/2 z-30 mb-2 flex max-h-72 w-[min(32rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3 shadow-xl">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                      Soundboard
                    </span>
                    <label className="mari-chrome-control mari-chrome-control--small inline-flex cursor-pointer items-center gap-1.5 text-xs">
                      <Upload size="0.75rem" />
                      Upload
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = "";
                          if (!file) return;
                          uploadSound.mutate({ file, name: file.name.replace(/\.[^.]+$/, "") });
                        }}
                      />
                    </label>
                  </div>
                  <div className="grid gap-1.5 overflow-y-auto sm:grid-cols-2">
                    {sounds.map((sound) => (
                      <div
                        key={sound.id}
                        className="flex items-center gap-1 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-2 py-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => playSound(sound)}
                          className="min-w-0 flex-1 truncate rounded px-1 text-left text-xs text-[var(--marinara-chat-chrome-panel-text)] transition-colors hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
                        >
                          {sound.name}
                        </button>
                        {!sound.builtIn && (
                          <button
                            type="button"
                            onClick={() => deleteSound.mutate(sound.id)}
                            className="rounded p-1 text-[var(--marinara-chat-chrome-panel-muted)] hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--destructive)]"
                            title="Delete sound"
                          >
                            <Trash2 size="0.75rem" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {voiceVolumeOpen && (
                <div className="absolute bottom-full left-1/2 z-30 mb-2 flex w-[min(18rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-3 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3 shadow-xl">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                      Character volume
                    </span>
                    <span className="text-xs tabular-nums text-[var(--marinara-chat-chrome-panel-muted)]">
                      {characterVoiceVolumeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleCharacterVoicesMuted}
                      aria-pressed={characterVoicesMuted}
                      className={cn(
                        "mari-chrome-control h-9 w-9 p-0",
                        characterVoicesMuted && "mari-chrome-control--selected",
                      )}
                      title={characterVoicesMuted ? "Unmute character voices" : "Mute character voices"}
                    >
                      {characterVoicesMuted ? <VolumeX size="0.95rem" /> : <Volume2 size="0.95rem" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={conversationCallVoiceVolume}
                      onChange={(event) => setConversationCallVoiceVolume(Number(event.currentTarget.value))}
                      className="min-w-0 flex-1"
                      aria-label="Character voice volume"
                    />
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "grid w-[calc(100vw-1.5rem)] items-center justify-center gap-1 overflow-visible rounded-2xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-1.5 shadow-xl shadow-black/20 sm:flex sm:w-auto sm:max-w-[calc(100vw-1.5rem)] sm:gap-2 sm:p-2",
                  callControlGridColumns,
                )}
              >
                <div className="relative flex min-w-0 justify-center max-sm:w-full">
                  {mutedReminderVisible && !recording ? (
                    <div
                      className="absolute bottom-full left-1/2 z-30 mb-3 hidden w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-2.5 pr-8 text-left text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-title)] shadow-xl shadow-black/25 sm:block"
                      role="status"
                    >
                      <button
                        type="button"
                        onClick={() => setMutedReminderVisible(false)}
                        className="absolute right-1.5 top-1.5 rounded-md p-1 text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
                        aria-label="Dismiss muted reminder"
                      >
                        <X size="0.75rem" />
                      </button>
                      You are muted! Remember to unmute yourself first if you want to talk.
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    disabled={!callAudioEnabled}
                    aria-pressed={recording}
                    className={cn(callControlButtonClass, recording && "mari-chrome-control--selected")}
                    title={
                      !callAudioEnabled
                        ? "Enable call audio in Chat Settings"
                        : recording
                          ? nativeInputMode
                            ? "Mute microphone"
                            : systemVoiceInputMode
                              ? "Stop dictation"
                              : "Mute microphone"
                          : systemVoiceInputMode
                            ? "Use manual system dictation"
                            : recordingWillUseLocalWhisperFallback
                              ? "Unmute microphone with Local Whisper"
                              : nativeInputMode
                                ? "Unmute microphone with provider-native audio"
                                : localWhisperInputMode
                                  ? "Unmute microphone with Local Whisper"
                                  : "Speak with browser speech recognition"
                    }
                  >
                    {recording ? (
                      <Mic className={callControlIconClass} />
                    ) : systemVoiceInputMode ? (
                      <Mic className={callControlIconClass} />
                    ) : (
                      <MicOff className={callControlIconClass} />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={toggleCamera}
                  disabled={!videoControlsEnabled}
                  aria-pressed={Boolean(cameraStream)}
                  className={callControlButtonClass}
                  title={
                    videoControlsEnabled
                      ? cameraStream
                        ? "Turn camera off"
                        : "Turn camera on"
                      : nativeInputMode
                        ? "Enable camera input in Chat Settings"
                        : "Switch audio input mode to provider-native audio/video"
                  }
                >
                  {cameraStream ? (
                    <Video className={callControlIconClass} />
                  ) : (
                    <VideoOff className={callControlIconClass} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={toggleScreenShare}
                  disabled={!videoControlsEnabled}
                  aria-pressed={Boolean(screenStream)}
                  className={callControlButtonClass}
                  title={
                    videoControlsEnabled
                      ? screenStream
                        ? "Stop sharing screen"
                        : "Share screen"
                      : nativeInputMode
                        ? "Enable screen input in Chat Settings"
                        : "Switch audio input mode to provider-native audio/video"
                  }
                >
                  {screenStream ? (
                    <ScreenShareOff className={callControlIconClass} />
                  ) : (
                    <ScreenShare className={callControlIconClass} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceVolumeOpen((value) => !value);
                    setSoundboardOpen(false);
                  }}
                  aria-pressed={voiceVolumeOpen || characterVoicesMuted}
                  className={callControlButtonClass}
                  title={`Character volume: ${characterVoiceVolumeLabel}`}
                >
                  {characterVoicesMuted ? (
                    <VolumeX className={callControlIconClass} />
                  ) : (
                    <Volume2 className={callControlIconClass} />
                  )}
                </button>
                {soundboardEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setSoundboardOpen((value) => !value);
                      setVoiceVolumeOpen(false);
                    }}
                    aria-pressed={soundboardOpen}
                    className={callControlButtonClass}
                    title="Soundboard"
                  >
                    <Sparkles className={callControlIconClass} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileChatOpen(true)}
                  className={cn(callControlButtonClass, "md:!hidden")}
                  title="Open call chat"
                >
                  <MessageCircle className={callControlIconClass} />
                </button>
                <button
                  type="button"
                  onClick={handleEnd}
                  disabled={endCall.isPending}
                  className={cn(callControlButtonClass, "mari-chrome-control--danger")}
                  title="End call"
                >
                  {endCall.isPending ? (
                    <Loader2 className={cn(callControlIconClass, "animate-spin")} />
                  ) : (
                    <PhoneOff className="h-4 w-4 sm:h-[1.1rem] sm:w-[1.1rem]" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden min-h-0 flex-1 basis-1/2 flex-col bg-[var(--background)] md:flex">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{renderCallMessages()}</div>
          {renderCallComposer()}
        </div>
      </div>
      {mobileChatOpen && (
        <div className="absolute inset-0 z-40 flex flex-col bg-[var(--background)] md:hidden">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                Call Chat
              </div>
              <div className="text-xs text-[var(--marinara-chat-chrome-panel-muted)]">{elapsedLabel}</div>
            </div>
            <button
              type="button"
              onClick={() => setMobileChatOpen(false)}
              className="mari-chrome-control h-9 w-9 p-0"
              title="Close call chat"
            >
              <X size="1rem" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{renderCallMessages()}</div>
          {renderCallComposer()}
        </div>
      )}
    </div>
  );
}
