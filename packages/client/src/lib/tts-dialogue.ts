import { decodeEncodedSpeakerTags, type TTSConfig } from "@marinara-engine/shared";
import { DIALOGUE_QUOTE_CAPTURE_GROUP_PATTERN_SOURCE, stripSurroundingDialogueQuotes } from "./dialogue-quotes";

export interface TTSUtterance {
  text: string;
  speaker?: string;
  tone?: string;
}

export interface TTSVoiceRequest {
  text: string;
  speaker?: string;
  tone?: string;
  voice?: string;
  pauseAfterMs?: number;
}

export interface CachedTTSVoiceRequest extends TTSVoiceRequest {
  cacheKey: string;
  cacheAliases?: string[];
}

export function normalizeTTSCharacterName(value?: string | null): string {
  return (value ?? "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeTTSCharacterBaseName(value?: string | null): string {
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

export function isTTSNarratorSpeaker(value?: string | null): boolean {
  const normalized = normalizeTTSCharacterName(value);
  return normalized === "narrator" || normalized === "gm" || normalized === "game master" || normalized === "system";
}

export type TTSNpcVoiceGender = "male" | "female" | "unknown";

export interface TTSNpcVoiceHint {
  name: string;
  description?: string | null;
  gender?: string | null;
  pronouns?: string | null;
  notes?: string[] | null;
}

const MALE_NPC_HINTS =
  /\b(he|him|his|himself|man|male|boy|father|brother|son|husband|king|prince|lord|sir|gentleman|waiter|barman|guard|soldier|wizard|priest)\b/i;
const FEMALE_NPC_HINTS =
  /\b(she|her|hers|herself|woman|female|girl|mother|sister|daughter|wife|queen|princess|lady|madam|waitress|barmaid|maid|witch|priestess)\b/i;

function stableTTSIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % length;
}

function hashTTSCacheKey(value: string): string {
  let h1 = 0xdeadbeef ^ value.length;
  let h2 = 0x41c6ce57 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    const ch = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${value.length.toString(36)}-${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`;
}

function buildTTSConfigCacheSignature(config: TTSConfig): string {
  return [
    config.source,
    config.baseUrl,
    config.model,
    config.audioFormat,
    config.speed,
    config.elevenLabsStability,
    config.elevenLabsLanguageCode,
    config.voice,
    config.narratorVoiceEnabled ? "narrator-voice" : "narrator-global",
    config.narratorVoice,
    config.voiceMode,
    JSON.stringify(config.voiceAssignments ?? []),
    config.npcDefaultVoicesEnabled ? "npc-defaults" : "npc-global",
    JSON.stringify(config.npcDefaultMaleVoices ?? []),
    JSON.stringify(config.npcDefaultFemaleVoices ?? []),
  ].join("\n");
}

export function withTTSVoiceRequestCacheKeys(
  requests: TTSVoiceRequest[],
  config: TTSConfig,
  messageId: string,
): CachedTTSVoiceRequest[] {
  const configSignature = buildTTSConfigCacheSignature(config);
  return requests.map((request, index) => {
    const requestSignature = [
      configSignature,
      request.voice ?? "",
      request.speaker ?? "",
      request.tone ?? "",
      request.text,
    ].join("\n");
    const textHash = hashTTSCacheKey(requestSignature);
    const messageHash = hashTTSCacheKey(`${messageId}\n${index}\n${requestSignature}`);
    return {
      ...request,
      cacheKey: `chat-voice-line-v2:${messageId}:${index}:${messageHash}`,
      cacheAliases: [`chat-voice-line-text-v2:${textHash}`],
    };
  });
}

export function inferTTSNpcVoiceGender(hint?: TTSNpcVoiceHint | null): TTSNpcVoiceGender {
  const explicitText = [hint?.gender, hint?.pronouns].filter(Boolean).join(" ");
  if (/\b(she|her|hers|female|feminine|woman|girl)\b/i.test(explicitText)) return "female";
  if (/\b(he|him|his|male|masculine|man|boy)\b/i.test(explicitText)) return "male";
  if (/\b(they|them|their|nonbinary|non-binary|neutral|unknown)\b/i.test(explicitText)) return "unknown";

  const text = [hint?.name, hint?.description, ...(hint?.notes ?? [])].filter(Boolean).join(" ");
  if (!text.trim()) return "unknown";

  const female = FEMALE_NPC_HINTS.test(text);
  const male = MALE_NPC_HINTS.test(text);
  if (female && !male) return "female";
  if (male && !female) return "male";
  return "unknown";
}

function sameVoicePool(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((voice) => rightSet.has(voice));
}

function resolveNpcDefaultVoice(
  config: Partial<
    Pick<TTSConfig, "source" | "npcDefaultVoicesEnabled" | "npcDefaultMaleVoices" | "npcDefaultFemaleVoices">
  >,
  npcHint?: TTSNpcVoiceHint | null,
): string {
  if (!config.npcDefaultVoicesEnabled || !npcHint) return "";

  const maleVoices = (config.npcDefaultMaleVoices ?? []).filter(Boolean);
  const femaleVoices = (config.npcDefaultFemaleVoices ?? []).filter(Boolean);
  const combinedVoices = [...new Set([...femaleVoices, ...maleVoices])];
  const gender = inferTTSNpcVoiceGender(npcHint);
  const poolsAreUnpartitioned = sameVoicePool(maleVoices, femaleVoices);
  const pool =
    gender === "female"
      ? !poolsAreUnpartitioned && femaleVoices.length > 0
        ? femaleVoices
        : combinedVoices
      : gender === "male"
        ? !poolsAreUnpartitioned && maleVoices.length > 0
          ? maleVoices
          : combinedVoices
        : combinedVoices;

  if (pool.length === 0) return "";
  const seed = normalizeTTSCharacterName(npcHint.name) || npcHint.name;
  return pool[stableTTSIndex(seed, pool.length)] ?? "";
}

export function resolveTTSVoiceForSpeaker(
  config: Pick<TTSConfig, "voice"> &
    Partial<
      Pick<
        TTSConfig,
        | "source"
        | "voiceMode"
        | "voiceAssignments"
        | "narratorVoiceEnabled"
        | "narratorVoice"
        | "npcDefaultVoicesEnabled"
        | "npcDefaultMaleVoices"
        | "npcDefaultFemaleVoices"
      >
    >,
  speaker?: string | null,
  characterId?: string | null,
  npcHint?: TTSNpcVoiceHint | null,
): string {
  const fallbackVoice = config.voice ?? "";
  if (config.narratorVoiceEnabled && isTTSNarratorSpeaker(speaker)) return config.narratorVoice || fallbackVoice;

  if (config.voiceMode === "per-character") {
    const assignments = Array.isArray(config.voiceAssignments) ? config.voiceAssignments : [];
    const normalizedSpeaker = normalizeTTSCharacterName(speaker);
    const exactAssignment = assignments.find((entry) => {
      if (!entry.voice) return false;
      if (characterId && entry.characterId === characterId) return true;
      return normalizedSpeaker.length > 0 && normalizeTTSCharacterName(entry.characterName) === normalizedSpeaker;
    });
    if (exactAssignment?.voice) return exactAssignment.voice;

    const normalizedSpeakerBase = normalizeTTSCharacterBaseName(speaker);
    if (normalizedSpeakerBase) {
      const baseMatchedVoices = new Set<string>();
      for (const entry of assignments) {
        if (!entry.voice || !entry.characterName) continue;
        if (normalizeTTSCharacterBaseName(entry.characterName) === normalizedSpeakerBase) {
          baseMatchedVoices.add(entry.voice);
        }
      }
      if (baseMatchedVoices.size === 1) return [...baseMatchedVoices][0] ?? "";
    }
  }

  const npcDefaultVoice = resolveNpcDefaultVoice(config, npcHint);
  if (npcDefaultVoice) return npcDefaultVoice;
  if (config.source === "elevenlabs" && config.npcDefaultVoicesEnabled && npcHint) return "";
  return fallbackVoice;
}

export function resolveTTSNarratorVoice(
  config: Pick<TTSConfig, "voice"> & Partial<Pick<TTSConfig, "narratorVoiceEnabled" | "narratorVoice">>,
): string {
  const fallbackVoice = config.voice ?? "";
  return config.narratorVoiceEnabled ? config.narratorVoice || fallbackVoice : fallbackVoice;
}

const VN_TTS_LINE_PREFIX_RE =
  /^\s*(?:Dialogue\s*)?\[[^\]\r\n]+\]\s*(?:\[(?:main|side|extra|action|thought|whisper(?::[^\]\r\n]+)?)\])?\s*(?:\[[^\]\r\n]+\])?\s*:\s*/gim;

const VN_TTS_METADATA_TAG_RE =
  /\[(?:main|side|extra|action|thought|whisper(?::[^\]\r\n]+)?|neutral|happy|sad|angry|surprised|scared|disgusted|thinking|laughing|crying|blushing|smirk|embarrassed|determined|confused|sleepy|custom)\]/gi;

function stripTTSMarkup(value: string, preserveSpeakerTags = false): string {
  const withoutNonSpeechBlocks = value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(style|script|template|code|pre|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");

  if (!preserveSpeakerTags) return withoutNonSpeechBlocks.replace(/<[^>]+>/g, " ");
  return withoutNonSpeechBlocks.replace(/<(?!\/?speaker(?:=|\s|>))[^>]+>/gi, " ");
}

export function cleanTTSInputText(value: string): string {
  return stripTTSMarkup(value)
    .replace(VN_TTS_LINE_PREFIX_RE, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/~~([\s\S]*?)~~/g, "$1")
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    .replace(/__([\s\S]*?)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/[*~`]/g, "")
    .replace(/\{(shake|shout|whisper|glow|pulse|wave|flicker|drip|bounce|tremble|glitch|expand):([^}]+)\}/gi, "$2")
    .replace(/\[[a-z_]+:[^\]]*\]/gi, "")
    .replace(VN_TTS_METADATA_TAG_RE, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

const DEFAULT_TTS_CHUNK_CHAR_LIMIT = 900;

function splitOversizedTTSPiece(value: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";
  const words = value.split(/\s+/).filter(Boolean);

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) chunks.push(current);
      current = word;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function packTTSChunkPieces(pieces: string[], maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const piece of pieces.map((part) => part.trim()).filter(Boolean)) {
    if (piece.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      const clausePieces = piece.match(/[^,;:]+[,;:]?|[,;:]+/g)?.filter((part) => part.trim()) ?? [];
      if (clausePieces.length > 1 && clausePieces.every((part) => part.trim().length < piece.length)) {
        chunks.push(...packTTSChunkPieces(clausePieces, maxChars));
      } else {
        chunks.push(...splitOversizedTTSPiece(piece, maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${piece}` : piece;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) chunks.push(current);
      current = piece;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitCleanTTSInputIntoChunks(value: string, maxChars = DEFAULT_TTS_CHUNK_CHAR_LIMIT): string[] {
  if (value.length <= maxChars) return [value];
  const sentencePieces = value.match(/[^.!?…。！？]+(?:[.!?…。！？]+["')\]}»”’]*)?|[.!?…。！？]+["')\]}»”’]*|.+/g) ?? [
    value,
  ];
  return packTTSChunkPieces(sentencePieces, maxChars);
}

export function splitTTSChunks(value: string): string[] {
  return value
    .split(/\r?\n+/)
    .map(cleanTTSInputText)
    .filter(Boolean)
    .flatMap((chunk) => splitCleanTTSInputIntoChunks(chunk));
}

export function buildTTSMessageText(text: string, config: TTSConfig, fallbackSpeaker?: string | null): string {
  const normalized = decodeEncodedSpeakerTags(text);
  if (!config.dialogueOnly) return cleanTTSInputText(normalized);
  return extractDialogueUtterances(normalized, fallbackSpeaker)
    .map((utterance) => utterance.text)
    .join("\n");
}

export function buildTTSVoiceRequests(
  text: string,
  config: TTSConfig,
  fallbackSpeaker?: string | null,
  fallbackCharacterId?: string | null,
  resolveCharacterIdForSpeaker?: (speaker?: string | null) => string | null | undefined,
): TTSVoiceRequest[] {
  const normalized = decodeEncodedSpeakerTags(text);
  const hasSpeakerTags = /<speaker="[^"]*">/i.test(normalized);
  const shouldExtractUtterances = config.dialogueOnly || hasSpeakerTags;
  const utterances =
    hasSpeakerTags && !config.dialogueOnly
      ? extractSpeakerTaggedUtterances(normalized, fallbackSpeaker, true)
      : shouldExtractUtterances
        ? extractDialogueUtterances(normalized, fallbackSpeaker)
        : [{ text: cleanTTSInputText(normalized), speaker: fallbackSpeaker || undefined } satisfies TTSUtterance];

  const fallbackSpeakerKey = normalizeTTSCharacterName(fallbackSpeaker);
  return utterances.flatMap((utterance, utteranceIndex) => {
    const speaker = utterance.speaker || fallbackSpeaker || undefined;
    const speakerKey = normalizeTTSCharacterName(speaker);
    const resolvedCharacterId = speaker
      ? (resolveCharacterIdForSpeaker?.(speaker) ??
        (speakerKey && speakerKey === fallbackSpeakerKey ? fallbackCharacterId : undefined))
      : fallbackCharacterId;
    const voice = resolveTTSVoiceForSpeaker(config, speaker, resolvedCharacterId);
    if (config.source === "elevenlabs" && !voice) return [];

    const chunks = splitTTSChunks(utterance.text);
    return chunks.map((chunk, chunkIndex) => ({
      text: chunk,
      speaker,
      tone: utterance.tone,
      voice,
      ...(config.dialogueOnly &&
      utteranceIndex < utterances.length - 1 &&
      chunkIndex === chunks.length - 1 &&
      config.dialoguePauseMs > 0
        ? { pauseAfterMs: config.dialoguePauseMs }
        : {}),
    }));
  });
}

function isLikelyTTSVNSpeaker(value: string): boolean {
  const speaker = value.trim();
  if (!speaker || speaker.length > 48) return false;
  if (/^(?:ooc|note|notes?|meta|system|debug|info|warning|warn|time|timestamp|link|url|image|img)$/i.test(speaker)) {
    return false;
  }
  if (/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?$/i.test(speaker)) return false;
  if (/^(?:https?:\/\/|www\.)/i.test(speaker)) return false;
  if (/^\d+$/.test(speaker)) return false;
  return /^[\p{L}\p{N}][\p{L}\p{N}' ._-]{0,47}$/u.test(speaker);
}

export function extractDialogueUtterances(text: string, fallbackSpeaker?: string | null): TTSUtterance[] {
  // Remove ordinary HTML before looking for quoted dialogue. Otherwise quote
  // marks inside style/class attributes are mistaken for spoken lines.
  const speechText = stripTTSMarkup(text, true);
  const utterances: TTSUtterance[] = [];
  utterances.push(...extractSpeakerTaggedUtterances(speechText, fallbackSpeaker, false));
  const untaggedSpeechText = speechText.replace(/<speaker="[^"]*">[\s\S]*?<\/speaker>/gi, " ");

  const vnLineRe = /^\s*(?:Dialogue\s*)?\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;
  for (const rawLine of untaggedSpeechText.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(vnLineRe);
    if (!match) continue;

    const rawSpeaker = match[1]?.trim() ?? "";
    if (!isLikelyTTSVNSpeaker(rawSpeaker)) continue;
    const speaker = rawSpeaker || fallbackSpeaker || undefined;
    const firstTag = match[2]?.trim();
    const secondTag = match[3]?.trim();
    const tone =
      secondTag ||
      (firstTag && !/^(main|side|extra|thought|action|whisper(?::.+)?)$/i.test(firstTag) ? firstTag : undefined);
    const spoken = cleanTTSInputText(stripSurroundingDialogueQuotes((match[4] ?? "").trim()));
    if (spoken) {
      utterances.push({ text: spoken, speaker, tone });
    }
  }

  const quoteRe = new RegExp(DIALOGUE_QUOTE_CAPTURE_GROUP_PATTERN_SOURCE, "g");
  let quoteMatch: RegExpExecArray | null;
  while ((quoteMatch = quoteRe.exec(untaggedSpeechText)) !== null) {
    const spoken = cleanTTSInputText(
      quoteMatch.slice(1).find((group) => typeof group === "string" && group.length > 0) ?? "",
    );
    if (spoken) {
      utterances.push({ text: spoken, speaker: fallbackSpeaker || undefined });
    }
  }

  return dedupeUtterances(utterances);
}

function extractSpeakerTaggedUtterances(
  text: string,
  fallbackSpeaker?: string | null,
  includeNarration = false,
): TTSUtterance[] {
  const utterances: TTSUtterance[] = [];
  const speakerTagRe = /<speaker="([^"]*)">([\s\S]*?)<\/speaker>/gi;
  let speakerTagMatch: RegExpExecArray | null;
  let lastIndex = 0;

  const addNarration = (value: string) => {
    if (!includeNarration) return;
    const spoken = cleanTTSInputText(value);
    if (spoken) utterances.push({ text: spoken, speaker: "Narrator" });
  };

  while ((speakerTagMatch = speakerTagRe.exec(text)) !== null) {
    addNarration(text.slice(lastIndex, speakerTagMatch.index));

    const speaker = speakerTagMatch[1]?.trim() || fallbackSpeaker || undefined;
    const spoken = cleanTTSInputText(stripSurroundingDialogueQuotes((speakerTagMatch[2] ?? "").trim()));
    if (spoken) {
      utterances.push({ text: spoken, speaker });
    }
    lastIndex = speakerTagRe.lastIndex;
  }

  addNarration(text.slice(lastIndex));
  return utterances;
}

function dedupeUtterances(utterances: TTSUtterance[]): TTSUtterance[] {
  const seen = new Set<string>();
  const result: TTSUtterance[] = [];
  for (const utterance of utterances) {
    const key = `${normalizeTTSCharacterName(utterance.speaker)}\n${utterance.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(utterance);
  }
  return result;
}
