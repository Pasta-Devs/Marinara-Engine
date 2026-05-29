import type { TTSConfig } from "../../engine/contracts/types/tts";
import {
  DIALOGUE_QUOTE_CAPTURE_GROUP_PATTERN_SOURCE,
  DIALOGUE_QUOTE_PATTERN_SOURCE,
  stripSurroundingDialogueQuotes,
} from "./dialogue-quotes";

export function clientSidePlaybackRate(cfg: TTSConfig | null | undefined): number {
  if (!cfg || cfg.source !== "openai") return 1;

  const baseUrl = (cfg.baseUrl || "").toLowerCase();
  if (baseUrl.includes("api.openai.com")) return 1;

  return Number.isFinite(cfg.speed) && cfg.speed > 0 ? cfg.speed : 1;
}

interface TTSUtterance {
  text: string;
  speaker?: string;
  tone?: string;
}

export interface TTSVoiceRequest {
  text: string;
  speaker?: string;
  tone?: string;
  voice?: string;
}

const TTS_NARRATOR_SPEAKER = "__tts_narrator__";

function isSyntheticTTSNarrator(speaker?: string | null): boolean {
  return speaker === TTS_NARRATOR_SPEAKER;
}

export function normalizeTTSCharacterName(value?: string | null): string {
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

export function ttsConfigMatchesSpeaker(
  _config: Pick<TTSConfig, "dialogueScope" | "dialogueCharacterName">,
  _speaker?: string | null,
) {
  return true;
}

type TTSNpcVoiceGender = "male" | "female" | "unknown";

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

function inferTTSNpcVoiceGender(hint?: TTSNpcVoiceHint | null): TTSNpcVoiceGender {
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
  if (config.source !== "elevenlabs" || !config.npcDefaultVoicesEnabled || !npcHint) return "";

  const maleVoices = (config.npcDefaultMaleVoices ?? []).filter(Boolean);
  const femaleVoices = (config.npcDefaultFemaleVoices ?? []).filter(Boolean);
  const gender = inferTTSNpcVoiceGender(npcHint);
  const poolsAreUnpartitioned = sameVoicePool(maleVoices, femaleVoices);
  const pool =
    gender === "female"
      ? !poolsAreUnpartitioned && femaleVoices.length > 0
        ? femaleVoices
        : []
      : gender === "male"
        ? !poolsAreUnpartitioned && maleVoices.length > 0
          ? maleVoices
          : []
        : [...new Set([...femaleVoices, ...maleVoices])];

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
  if (
    config.narratorVoiceEnabled &&
    isSyntheticTTSNarrator(speaker) &&
    (config.voiceMode ?? "single") === "single"
  ) {
    return config.narratorVoice || fallbackVoice;
  }

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

function cleanTTSInputText(value: string): string {
  return value
    .replace(/\{(shake|shout|whisper|glow|pulse|wave|flicker|drip|bounce|tremble|glitch|expand):([^}]+)\}/gi, "$2")
    .replace(/\[[a-z_]+:[^\]]*\]/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
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

function splitQuotedDialogueAndNarration(text: string, fallbackSpeaker?: string | null): TTSUtterance[] {
  const quoteRe = new RegExp(DIALOGUE_QUOTE_PATTERN_SOURCE, "g");
  const utterances: TTSUtterance[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = quoteRe.exec(text)) !== null) {
    const narrationBefore = cleanTTSInputText(text.slice(lastIndex, match.index));
    if (narrationBefore) {
      utterances.push({ text: narrationBefore, speaker: TTS_NARRATOR_SPEAKER });
    }

    const dialogue = cleanTTSInputText(stripSurroundingDialogueQuotes(match[0]));
    if (dialogue) {
      utterances.push({ text: dialogue, speaker: fallbackSpeaker || undefined });
    }

    lastIndex = match.index + match[0].length;
  }

  const narrationAfter = cleanTTSInputText(text.slice(lastIndex));
  if (narrationAfter) {
    utterances.push({ text: narrationAfter, speaker: TTS_NARRATOR_SPEAKER });
  }

  return utterances;
}

export function buildTTSVoiceRequests(
  text: string,
  config: TTSConfig,
  fallbackSpeaker?: string | null,
  fallbackCharacterId?: string | null,
  resolveCharacterIdForSpeaker?: (speaker?: string | null) => string | null | undefined,
): TTSVoiceRequest[] {
  const hasSpeakerTags = /<speaker="[^"]*">/i.test(text);
  const shouldExtractUtterances = config.dialogueOnly || hasSpeakerTags;
  const shouldAutoSplitForNarrator =
    !hasSpeakerTags &&
    !config.dialogueOnly &&
    config.narratorVoiceEnabled &&
    (config.voiceMode ?? "single") === "single";
  const utterances =
    hasSpeakerTags && !config.dialogueOnly
      ? extractSpeakerTaggedUtterances(text, config, fallbackSpeaker, true)
      : shouldExtractUtterances
        ? extractDialogueUtterances(text, config, fallbackSpeaker)
        : shouldAutoSplitForNarrator
          ? splitQuotedDialogueAndNarration(text, fallbackSpeaker)
          : [{ text: cleanTTSInputText(text), speaker: fallbackSpeaker || undefined } satisfies TTSUtterance];

  const fallbackSpeakerKey = normalizeTTSCharacterName(fallbackSpeaker);
  return utterances.flatMap((utterance) => {
    const speaker = utterance.speaker || fallbackSpeaker || undefined;
    const isSyntheticNarrator = isSyntheticTTSNarrator(speaker);
    const speakerKey = normalizeTTSCharacterName(speaker);
    const resolvedCharacterId = isSyntheticNarrator
      ? undefined
      : speaker
      ? (resolveCharacterIdForSpeaker?.(speaker) ??
        (speakerKey && speakerKey === fallbackSpeakerKey ? fallbackCharacterId : undefined))
      : fallbackCharacterId;
    const voice = resolveTTSVoiceForSpeaker(config, speaker, resolvedCharacterId);
    if (config.source === "elevenlabs" && !voice) return [];
    const requestSpeaker = isSyntheticNarrator ? "Narrator" : speaker;

    return splitTTSChunks(utterance.text).map((chunk) => ({
      text: chunk,
      speaker: requestSpeaker,
      tone: utterance.tone,
      voice,
    }));
  });
}

function extractDialogueUtterances(
  text: string,
  config: Pick<TTSConfig, "dialogueScope" | "dialogueCharacterName">,
  fallbackSpeaker?: string | null,
): TTSUtterance[] {
  const utterances: TTSUtterance[] = [];
  utterances.push(...extractSpeakerTaggedUtterances(text, config, fallbackSpeaker, false));

  const vnLineRe = /^\s*(?:Dialogue\s*)?\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(vnLineRe);
    if (!match) continue;

    const speaker = match[1]?.trim() || fallbackSpeaker || undefined;
    const firstTag = match[2]?.trim();
    const secondTag = match[3]?.trim();
    const tone =
      secondTag ||
      (firstTag && !/^(main|side|extra|thought|action|whisper(?::.+)?)$/i.test(firstTag) ? firstTag : undefined);
    const spoken = cleanTTSInputText(stripSurroundingDialogueQuotes((match[4] ?? "").trim()));
    if (spoken && ttsConfigMatchesSpeaker(config, speaker)) {
      utterances.push({ text: spoken, speaker, tone });
    }
  }

  if (utterances.length > 0) {
    return dedupeUtterances(utterances);
  }

  const quoteRe = new RegExp(DIALOGUE_QUOTE_CAPTURE_GROUP_PATTERN_SOURCE, "g");
  let quoteMatch: RegExpExecArray | null;
  while ((quoteMatch = quoteRe.exec(text)) !== null) {
    const spoken = cleanTTSInputText(
      quoteMatch.slice(1).find((group) => typeof group === "string" && group.length > 0) ?? "",
    );
    if (spoken && ttsConfigMatchesSpeaker(config, fallbackSpeaker)) {
      utterances.push({ text: spoken, speaker: fallbackSpeaker || undefined });
    }
  }

  return dedupeUtterances(utterances);
}

function extractSpeakerTaggedUtterances(
  text: string,
  config: Pick<TTSConfig, "dialogueScope" | "dialogueCharacterName">,
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
    if (spoken) utterances.push({ text: spoken, speaker: TTS_NARRATOR_SPEAKER });
  };

  while ((speakerTagMatch = speakerTagRe.exec(text)) !== null) {
    addNarration(text.slice(lastIndex, speakerTagMatch.index));

    const speaker = speakerTagMatch[1]?.trim() || fallbackSpeaker || undefined;
    const spoken = cleanTTSInputText(stripSurroundingDialogueQuotes((speakerTagMatch[2] ?? "").trim()));
    if (spoken && ttsConfigMatchesSpeaker(config, speaker)) {
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
