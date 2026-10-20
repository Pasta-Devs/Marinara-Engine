// ──────────────────────────────────────────────
// Avatar director: chat activity → avatar frames (lane: director)
// ──────────────────────────────────────────────
// Roleplay: the visible stream text (the chat store's stream buffer, after think-tag filtering and rewrite agents)
// is cut into sentences and sent to the streaming classifier (/api/avatar-classify: keywords, or the local emotion
// model where the server has one; never an LLM), at most once every 1.2 s, with a cache per sentence. Faces change
// with hysteresis: a new emotion needs a score of 0.45 and a 0.15 lead over the current one, a face holds for at
// least 2 s, and going back to neutral takes two neutral sentences. 4 s after the reply ends the face relaxes,
// unless the Expression Engine has settled it. A more specific feeling inside the same emotion (amusement inside
// happy) changes on a 0.45 score and holds 2 s on its own clock, so the emotion's timing is the same with or
// without feelings; only a talking head with a face for the feeling shows it. Game: the Game Master's per-line
// expression for the line on screen.
// Either way an Expression Engine pick for this reply's message is the final face for that reply.
// A reply ends when its generation does (after the typewriter has shown it all). With streaming off it arrives whole
// (assistant_message_ready), is classified sentence by sentence and spoken within 8 s.
// Mouths: the speech clock speaks the visible dialogue (only dialogue, never narration); while text-to-speech
// plays for an owner, its audio level drives the mouth instead (subscribeAvatarAudio), and its moods follow the
// voice: each sentence of the clip's text shows as the voice reaches its share of the clip.
// Text-to-speech auto-play (Roleplay): the voice usually starts after the reply has streamed. While the reply will
// be read aloud, the text moves no mouth and its moods are held; the voice brings both, the face relaxes 4 s after
// the voice ends, and an Expression Engine pick shows once the reading is over. ChatArea says when a reading starts
// and ends (TTS_AUTOPLAY_VOICE_EVENT). A reading that never plays (an error, no lines to read, stopped) replays the
// text animation once if the reply ended moments ago, and otherwise shows the reply's last mood and relaxes.
// A Roleplay director asks the server to get the local emotion model ready (POST /api/avatar-classify/model): that,
// for a chat with an avatar agent on, is the only thing that downloads it.
// Everything runs on the stage's frame calls: no timers, and no work at all while the stage is paused.
import {
  AVATAR_API_PREFIXES,
  AVATAR_CLASSIFY_LIMITS,
  AVATAR_FEELING_EMOTIONS,
  AVATAR_NEUTRAL_FRAME,
  classifyExpressionKeywords,
  mapSpriteExpressionToAvatarEmotion,
  mapSpriteExpressionToAvatarFeeling,
  normalizeGroupChatMode,
  type AvatarClassification,
  type AvatarClassifyRequest,
  type AvatarClassifyResponse,
  type AvatarEmotion,
  type AvatarExtraFeeling,
  type AvatarFrameInput,
  type AvatarState,
} from "@marinara-engine/shared";
import { api } from "../../../lib/api-client";
import { parseChatMetadata } from "../../../lib/chat-display";
import {
  TTS_AUTOPLAY_MESSAGE_READY_EVENT,
  TTS_AUTOPLAY_VOICE_EVENT,
  type TTSAutoplayMessageReadyDetail,
  type TTSAutoplayVoiceDetail,
} from "../../../lib/tts-autoplay";
import { cleanTTSInputText, findTTSCharacterIdBySpeakerName } from "../../../lib/tts-dialogue";
import { useAgentStore } from "../../../stores/agent.store";
import { useChatStore } from "../../../stores/chat.store";
import { useUIStore } from "../../../stores/ui.store";
import { subscribeAvatarAudio } from "../audio/avatar-audio";
import type {
  AvatarAudioLevelSource,
  AvatarDirector,
  AvatarDirectorOptions,
  AvatarExpressionPick,
  AvatarGameLine,
  AvatarParticipant,
  AvatarStreamUpdate,
} from "../contract";
import { subscribeAvatarGameLines } from "./game-line-feed";
import {
  attributeReplyParagraphs,
  collectReplyDialogue,
  readReplySegments,
  type ReplyParagraph,
  type ReplySegment,
  type ReplySpeaker,
} from "./reply-text";
import { createSpeechClock, followMouthEnvelope, SPEECH_CLOCK, type SpeechClock } from "./speech-clock";

export const AVATAR_DIRECTOR_TIMING = Object.freeze({
  /** Gap between classifier requests. */
  classifyIntervalMs: 1_200,
  /** A new emotion needs this score, and this lead over the current emotion's score in the same result. */
  switchScore: 0.45,
  switchLead: 0.15,
  /** Shortest time a face holds before the classifier may change it. */
  minDwellMs: 2_000,
  /** Neutral sentences in a row before the face returns to neutral. */
  neutralSegments: 2,
  /** After the reply ends (and the face last changed), the face relaxes to neutral over decayMs. */
  settleAfterMs: 4_000,
  decayMs: 1_000,
  /** How often the growing reply text is re-read. */
  readIntervalMs: 80,
  /** A reply that arrives whole (streaming off) or a Game line is spoken within this time. */
  wholeSpeechMaxMs: 8_000,
  cacheSize: 256,
  /** While the server answers with keywords, how often to ask it again to get its local model ready. */
  prepareModelIntervalMs: 60_000,
  /** Text-to-speech auto-play: how long after the reply ends a reading may take to begin before the avatar stops
   *  waiting for it, and how long the voice may stay away (still loading, paused, or blocked until a tap) before
   *  the avatar stops waiting anyway. */
  voiceStartGraceMs: 2_000,
  voiceWaitMaxMs: 30_000,
  /** A reading that never played and ended this soon after the reply replays the text animation once. */
  voiceReplayWithinMs: 5_000,
});

/** The part of the server's model status the director reads. */
interface AvatarEmotionModelAnswer {
  unsupported: string | null;
}

/** Injection points for regressions: the classifier request and the model preparation request. */
export interface AvatarDirectorHooks {
  classify?(request: AvatarClassifyRequest, signal: AbortSignal): Promise<AvatarClassifyResponse>;
  prepareModel?(chatId: string): Promise<AvatarEmotionModelAnswer>;
}

interface OwnerState {
  ownerId: string;
  name: string;
  isPersona: boolean;
  emotion: AvatarEmotion;
  weight: number;
  label: string | null;
  switchedAt: number;
  /** The more specific feeling inside `emotion`, with its own hold clock and waiting change. */
  feeling: AvatarExtraFeeling | null;
  feelingSwitchedAt: number;
  pendingFeeling: AvatarExtraFeeling | null;
  neutralStreak: number;
  /** A result that passed the score rules while the face was still holding. */
  pending: AvatarClassification | null;
  /** The Expression Engine settled this reply's face: later classifier results do not apply. */
  settled: boolean;
  decayFrom: number | null;
  clock: SpeechClock;
  speaking: boolean;
  audio: AvatarAudioLevelSource | null;
  audioOpen: number;
  lastFrameMs: number | null;
  /** The last classifier result held while waiting for the voice. */
  held: AvatarClassification | null;
  /** The last frame time this owner's voice played, and whether it played during this reply's reading. */
  voiceAt: number;
  voicePlayed: boolean;
  /** An earlier reading's voice was still playing when this reading began; it is not this reading's voice. */
  voiceStale: boolean;
  /** The clip the voice is reading: its sentences, the next one to show, and how far the voice was. */
  line: { text: string; parts: ReplySegment[]; next: number; progress: number } | null;
  textTimeline: { text: string; from: number; ms: number } | null;
  gameSpeech: { id: string | undefined; text: string; from: number | null; pending: boolean } | null;
  gameVoiceLineId: string | null | undefined;
}

interface QueuedText {
  ownerId: string;
  text: string;
  turn: number;
  /** Fills the cache only: a voice line applies it when the voice reaches it. */
  cacheOnly?: boolean;
}

/** Sentences of a voice clip sent to the classifier ahead of the voice. */
const VOICE_LOOKAHEAD = 3;

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

function defaultClassify(request: AvatarClassifyRequest, signal: AbortSignal) {
  return api.post<AvatarClassifyResponse>(AVATAR_API_PREFIXES.classify, request, { signal });
}

function defaultPrepareModel(chatId: string) {
  return api.post<AvatarEmotionModelAnswer>(`${AVATAR_API_PREFIXES.classify}/model`, { chatId });
}

/** Whether a message's character is the one who wrote all of it: not in a Merged group, where the server saves the
 *  whole group reply under the first character. Unknown chats count as Merged groups when several characters show. */
function messageSpeakerIsReliable(chatId: string, characterCount: number): boolean {
  if (characterCount <= 1) return true;
  const chat = useChatStore.getState().activeChat;
  if (chat?.id !== chatId) return false;
  return normalizeGroupChatMode(parseChatMetadata(chat.metadata).groupChatMode) === "individual";
}

function newOwner(participant: AvatarParticipant): OwnerState {
  return {
    ownerId: participant.owner.ownerId,
    name: participant.name,
    isPersona: participant.owner.ownerType === "persona",
    emotion: "neutral",
    weight: 1,
    label: null,
    switchedAt: -Infinity,
    feeling: null,
    feelingSwitchedAt: -Infinity,
    pendingFeeling: null,
    neutralStreak: 0,
    pending: null,
    settled: false,
    decayFrom: null,
    clock: createSpeechClock(),
    speaking: false,
    audio: null,
    audioOpen: 0,
    lastFrameMs: null,
    held: null,
    voiceAt: -Infinity,
    voicePlayed: false,
    voiceStale: false,
    line: null,
    textTimeline: null,
    gameSpeech: null,
    gameVoiceLineId: null,
  };
}

export function createAvatarDirector(options: AvatarDirectorOptions, hooks: AvatarDirectorHooks = {}): AvatarDirector {
  const { chatId, mode } = options;
  const classify = hooks.classify ?? defaultClassify;
  const prepareModel = hooks.prepareModel ?? defaultPrepareModel;
  const T = AVATAR_DIRECTOR_TIMING;
  const owners = new Map<string, OwnerState>();
  // Audio can already be playing when the stage mounts, before its participants are registered.
  const audioSources = new Map<string, AvatarAudioLevelSource>();
  /** Sentence text → classification (a Map hashes the text). */
  const cache = new Map<string, AvatarClassification>();
  const unsubscribers: Array<() => void> = [];
  let lastTickMs: number | null = null;
  let now = 0;
  let disposed = false;
  let gameLinesSubscribed = false;

  // One generation, from send to the last token.
  let turn = 0;
  let generating = false;
  let expectedSpeakerId: string | null = null;
  let streamStarted = false;
  let streamEndedAt: number | null = null;
  let lineShownThisTurn = false;
  let shownGameLineId: string | undefined;
  let userTyping = false;
  /** This turn's reply rows: an Expression Engine pick for another message belongs to an earlier reply. */
  let replyMessageIds = new Set<string>();

  // The visible reply text: the newest, and how far it has been read.
  let latest: { text: string; speakerId: string | null } | null = null;
  let replyDone = false;
  /** Streaming is off this turn: the reply shows at once (assistant_message_ready, or a held rewrite). */
  let wholeReply = false;
  let dirty = false;
  let lastReadAt = -Infinity;
  let read: { text: string; speakerId: string | null } = { text: "", speakerId: null };
  let readOffset = 0;
  let spoken = new Map<string, string>();

  // Text-to-speech auto-play: whether it reads Roleplay replies, and this reply's reading. "waiting" holds the
  // text's mouth, moods and Expression Engine picks for the voice.
  let voiceAutoplay = false;
  let voice: "off" | "waiting" | "done" = "off";
  /** The reading ChatArea started for this reply, and whether that reading is still going. */
  let voiceReadingId: string | null = null;
  let voicePending = false;
  /** When the wait last had news: the generation ended, or a voice played. */
  let voiceNewsAt = -Infinity;
  let turnEndedAt = -Infinity;
  let heldPicks = new Map<string, string>();
  /** The text animation played once more, revealing the finished reply over `ms`. */
  let replay: { text: string; speakerId: string | null; from: number; ms: number } | null = null;

  // Classifier traffic.
  let queue: QueuedText[] = [];
  let arrived: Array<{ ownerId: string; turn: number; result: AvatarClassification }> = [];
  let inFlight: AbortController | null = null;
  let lastSentAt = -Infinity;
  // Getting the server's local model ready: asked at once, then again while it answers with keywords.
  let modelUnsupported = mode !== "roleplay";
  let lastPrepareAt = -Infinity;
  const askForModel = () => {
    if (modelUnsupported || disposed || Date.now() - lastPrepareAt < T.prepareModelIntervalMs) return;
    lastPrepareAt = Date.now();
    void prepareModel(chatId)
      .then((status) => {
        if (status?.unsupported) modelUnsupported = true;
      })
      .catch(() => {
        // Not ready, rate limited or offline: the keyword tier keeps answering.
      });
  };

  const characters = (): ReplySpeaker[] =>
    [...owners.values()].filter((owner) => !owner.isPersona).map(({ ownerId, name }) => ({ ownerId, name }));
  const ownerByName = (name: string): OwnerState | null => {
    const id = findTTSCharacterIdBySpeakerName(
      name,
      [...owners.values()].map((owner) => [owner.ownerId, { name: owner.name }] as const),
    );
    return id ? (owners.get(id) ?? null) : null;
  };
  const paragraphsOf = (text: string, speakerId: string | null): ReplyParagraph[] => {
    const speakers = characters();
    const known = speakerId && owners.has(speakerId) ? speakerId : null;
    return attributeReplyParagraphs(text, speakers, known, speakers[0]?.ownerId ?? null);
  };
  const ownerAt = (paragraphs: readonly ReplyParagraph[], index: number) =>
    paragraphs.find((paragraph) => index >= paragraph.start && index <= paragraph.end)?.ownerId ??
    paragraphs.at(-1)?.ownerId ??
    null;

  const setFeeling = (owner: OwnerState, feeling: AvatarExtraFeeling | null) => {
    owner.feeling = feeling;
    owner.feelingSwitchedAt = now;
    owner.pendingFeeling = null;
  };

  const switchTo = (
    owner: OwnerState,
    emotion: AvatarEmotion,
    weight: number,
    label: string | null,
    feeling: AvatarExtraFeeling | null = null,
  ) => {
    owner.emotion = emotion;
    owner.weight = clamp01(weight);
    owner.label = label;
    owner.switchedAt = now;
    owner.pending = null;
    owner.neutralStreak = 0;
    owner.decayFrom = null;
    setFeeling(owner, feeling);
  };

  const applyClassification = (owner: OwnerState, result: AvatarClassification) => {
    if (owner.settled) return;
    if (result.emotion === owner.emotion) {
      owner.weight = clamp01((owner.weight + result.weight) / 2);
      owner.pending = null;
      owner.pendingFeeling = null;
      owner.neutralStreak = 0;
      owner.decayFrom = null;
      // No feeling keeps the current one; a new one follows the same score and hold rules as a new emotion.
      const feeling = result.feeling ?? null;
      if (!feeling || feeling === owner.feeling || result.weight < T.switchScore) return;
      if (now - owner.feelingSwitchedAt < T.minDwellMs) owner.pendingFeeling = feeling;
      else {
        // A face picked by label (an earlier reply's Expression Engine pick) gives way to the newer feeling.
        owner.label = null;
        setFeeling(owner, feeling);
      }
      return;
    }
    if (result.emotion === "neutral") {
      owner.neutralStreak += 1;
      if (owner.neutralStreak < T.neutralSegments) return;
    } else {
      owner.neutralStreak = 0;
    }
    if (result.weight < T.switchScore || result.weight < (result.scores[owner.emotion] ?? 0) + T.switchLead) return;
    if (now - owner.switchedAt < T.minDwellMs) {
      owner.pending = result;
      return;
    }
    switchTo(owner, result.emotion, result.weight, null, result.feeling ?? null);
  };

  /** A sprite label's emotion, and its feeling when that belongs to the same emotion. */
  const switchToLabel = (owner: OwnerState, label: string) => {
    const mapped = mapSpriteExpressionToAvatarEmotion(label) ?? { emotion: "neutral" as const, weight: 1 };
    const feeling = mapSpriteExpressionToAvatarFeeling(label);
    const ownFeeling = feeling && AVATAR_FEELING_EMOTIONS[feeling].emotion === mapped.emotion ? feeling : null;
    switchTo(owner, mapped.emotion, mapped.weight, label, ownFeeling);
  };

  const startTurn = () => {
    turn += 1;
    streamStarted = false;
    streamEndedAt = null;
    lineShownThisTurn = false;
    replyMessageIds = new Set();
    latest = null;
    replyDone = false;
    // Read the way use-generate reads it when the generation starts.
    wholeReply = !useUIStore.getState().enableStreaming;
    dirty = false;
    read = { text: "", speakerId: null };
    readOffset = 0;
    spoken = new Map();
    queue = [];
    arrived = [];
    inFlight?.abort();
    inFlight = null;
    voice = voiceAutoplay && mode === "roleplay" ? "waiting" : "off";
    voiceReadingId = null;
    voicePending = false;
    voiceNewsAt = -Infinity;
    turnEndedAt = -Infinity;
    heldPicks = new Map();
    replay = null;
    for (const owner of owners.values()) {
      owner.settled = false;
      owner.pending = null;
      owner.pendingFeeling = null;
      owner.neutralStreak = 0;
      owner.held = null;
      owner.voicePlayed = false;
      owner.textTimeline = null;
      owner.gameSpeech = null;
      owner.gameVoiceLineId = null;
      if (!owner.audio) owner.clock.clear();
    }
  };

  const finishReply = () => {
    if (!latest || replyDone) return;
    replyDone = true;
    dirty = true;
  };

  const setGenerating = (value: boolean) => {
    if (value === generating) return;
    generating = value;
    if (value) startTurn();
    else {
      turnEndedAt = voiceNewsAt = now;
      finishReply();
    }
  };

  const enqueue = (ownerId: string | null, text: string) => {
    if (ownerId && owners.has(ownerId)) queue.push({ ownerId, text, turn });
  };

  /** Re-reads the visible reply: new dialogue to the owners' speech clocks, new sentences to the classifier. */
  const readReply = () => {
    if (!latest) return;
    const { text, speakerId } = latest;
    if (!text.startsWith(read.text)) {
      // The next group speaker, or rewritten text: finish the sentence that was shown, then start over. Rewritten
      // text does not re-speak words that are already on screen; a new speaker speaks from the first word.
      const previous = paragraphsOf(read.text, read.speakerId);
      for (const segment of readReplySegments(read.text, readOffset, true).segments) {
        enqueue(ownerAt(previous, segment.start), segment.text);
      }
      spoken =
        speakerId !== read.speakerId
          ? new Map()
          : collectReplyDialogue(text, paragraphsOf(text, speakerId), characters());
      readOffset = 0;
    }
    const paragraphs = paragraphsOf(text, speakerId);
    // A growing paragraph that names nobody yet may name its speaker after the quote ('"Get out," Bob growls.'):
    // its dialogue and sentences wait until it names someone or ends, so they never go to the wrong avatar first.
    const last = paragraphs.at(-1);
    const settledEnd =
      !replyDone && !wholeReply && last?.inherited && last.end === text.length ? last.start : text.length;
    const settled = paragraphs.filter((paragraph) => paragraph.start < settledEnd);
    const saidNow = collectReplyDialogue(text, settled, characters());
    // An owner whose words moved to someone else has said nothing so far; their next line starts from empty.
    for (const ownerId of spoken.keys()) if (!saidNow.has(ownerId)) saidNow.set(ownerId, "");
    for (const [ownerId, said] of saidNow) {
      const before = spoken.get(ownerId) ?? "";
      spoken.set(ownerId, said);
      const owner = owners.get(ownerId);
      if (!owner || owner.audio?.isPlaying() || !said.startsWith(before) || said.length === before.length) continue;
      // The voice will move the mouth.
      if (voice === "waiting") continue;
      if (wholeReply) owner.clock.speakAll(said, T.wholeSpeechMaxMs);
      else owner.clock.push(said.slice(before.length));
    }
    if (!wholeReply) {
      const next = readReplySegments(text.slice(0, settledEnd), readOffset, replyDone);
      for (const segment of next.segments) enqueue(ownerAt(paragraphs, segment.start), segment.text);
      readOffset = next.next;
    } else if (replyDone && readOffset < text.length) {
      // Prepare each owner's sentences, then show their moods along the text speech timeline. Applying
      // all sentence results in one classifier batch would show only the final mood in the same frame.
      const byOwner = new Map<string, string[]>();
      for (const paragraph of paragraphs) {
        if (!paragraph.ownerId) continue;
        const parts = byOwner.get(paragraph.ownerId) ?? [];
        parts.push(text.slice(paragraph.start, paragraph.end));
        byOwner.set(paragraph.ownerId, parts);
      }
      for (const [ownerId, parts] of byOwner) {
        const owner = owners.get(ownerId);
        const plain = cleanTTSInputText(parts.join("\n"));
        if (!owner || !/\p{L}/u.test(plain)) continue;
        owner.line = null;
        owner.textTimeline = {
          text: plain,
          from: now,
          ms: Math.min(
            T.wholeSpeechMaxMs,
            ((spoken.get(ownerId)?.length || plain.length) / SPEECH_CLOCK.charsPerSecond) * 1000,
          ),
        };
      }
      readOffset = text.length;
    }
    read = { text, speakerId };
    if (replyDone) streamEndedAt = now;
  };

  const remember = (text: string, result: AvatarClassification) => {
    cache.delete(text);
    cache.set(text, result);
    if (cache.size > T.cacheSize) cache.delete(cache.keys().next().value!);
  };

  const sendQueued = () => {
    if (disposed || queue.length === 0 || inFlight || now - lastSentAt < T.classifyIntervalMs) return;
    const batch = queue.slice(-AVATAR_CLASSIFY_LIMITS.maxTexts);
    queue = [];
    const deliver = () => {
      for (const item of batch) {
        if (item.cacheOnly) continue;
        const result = cache.get(item.text) ?? classifyExpressionKeywords(item.text);
        arrived.push({ ownerId: item.ownerId, turn: item.turn, result });
      }
    };
    const texts = [...new Set(batch.map((item) => item.text))].filter((text) => !cache.has(text));
    if (texts.length === 0) {
      deliver();
      return;
    }
    lastSentAt = now;
    const controller = new AbortController();
    inFlight = controller;
    const request: AvatarClassifyRequest = { texts, tier: "local-model", debugMode: useUIStore.getState().debugMode };
    void classify(request, controller.signal)
      .then((response) => {
        texts.forEach((text, index) => {
          const result = response.results[index];
          if (result) remember(text, result);
        });
        // The model unloaded after idle minutes, or an earlier attempt failed: ask for it again (at most once a minute).
        if (response.tier === "keywords") askForModel();
      })
      .catch(() => {
        // Offline or rate limited: the same keyword list the server's instant tier uses.
        if (!controller.signal.aborted) for (const text of texts) remember(text, classifyExpressionKeywords(text));
      })
      .finally(() => {
        if (inFlight === controller) inFlight = null;
        if (!controller.signal.aborted && !disposed) deliver();
      });
  };

  const applyHeldPicks = () => {
    for (const [ownerId, expression] of heldPicks) {
      const owner = owners.get(ownerId);
      if (!owner) continue;
      switchToLabel(owner, expression);
      owner.settled = true;
    }
    heldPicks = new Map();
  };

  /** Plays the text animation once more: the finished reply is shown again over a few seconds, as it streamed. */
  const replayReply = () => {
    if (!latest) return;
    const { text, speakerId } = latest;
    const ms = wholeReply ? 0 : Math.min(T.wholeSpeechMaxMs, (text.length / SPEECH_CLOCK.charsPerSecond) * 1000);
    replay = { text, speakerId, from: now, ms };
    latest = { text: "", speakerId };
    read = { text: "", speakerId };
    readOffset = 0;
    spoken = new Map();
    replyDone = false;
  };

  const finishReplay = () => {
    replay = null;
    replyDone = true;
    dirty = true;
    // A whole reply still has its sentence timeline to play after it is revealed in this frame.
    if (!wholeReply) applyHeldPicks();
  };

  const revealReplay = (shown: { text: string; speakerId: string | null; from: number; ms: number }) => {
    const length = shown.ms > 0 ? Math.ceil((shown.text.length * (now - shown.from)) / shown.ms) : Infinity;
    if (length >= shown.text.length) {
      latest = { text: shown.text, speakerId: shown.speakerId };
      finishReplay();
    } else if (length > (latest?.text.length ?? 0)) {
      latest = { text: shown.text.slice(0, length), speakerId: shown.speakerId };
      dirty = true;
    }
  };

  /** The wait for the voice is over: it was read, never played, or stayed away too long. */
  const endVoice = () => {
    voice = "done";
    voicePending = false;
    const played = [...owners.values()].some((owner) => owner.voicePlayed);
    if (!played && !generating && streamEndedAt !== null && now - streamEndedAt <= T.voiceReplayWithinMs) {
      replayReply();
      return;
    }
    // The text is long gone: each avatar whose voice did not play shows the reply's last mood, then relaxes.
    for (const owner of owners.values()) {
      if (owner.voicePlayed) continue;
      if (owner.textTimeline) {
        if (played) {
          // Another group member got a voice; this owner's text moods still need their own paced fallback.
          owner.textTimeline.from = now;
          owner.line = null;
        } else {
          const last = readReplySegments(owner.textTimeline.text, 0, true).segments.at(-1);
          if (last) enqueue(owner.ownerId, last.text);
          owner.textTimeline = null;
        }
      }
      if (owner.held) applyClassification(owner, owner.held);
    }
    if (![...owners.values()].some((owner) => owner.textTimeline)) applyHeldPicks();
  };

  const checkVoice = () => {
    const over = voiceReadingId !== null && !voicePending && !generating;
    const neverBegan =
      voiceReadingId === null && (!voiceAutoplay || (!generating && now - turnEndedAt >= T.voiceStartGraceMs));
    const tooLong = !generating && now - voiceNewsAt >= T.voiceWaitMaxMs;
    if (over || neverBegan || tooLong) endVoice();
  };

  /** Shows each sentence of the clip the voice reads as the voice reaches its share of the clip. */
  const followVoice = (owner: OwnerState, heard: { text: string; progress: number }) => {
    let line = owner.line;
    if (!line || line.text !== heard.text || heard.progress < line.progress) {
      line = owner.line = {
        text: heard.text,
        parts: readReplySegments(heard.text, 0, true).segments,
        next: 0,
        progress: 0,
      };
    }
    line.progress = heard.progress;
    // The next sentences go to the classifier ahead of the voice; the cache answers the ones the reply had.
    for (const part of line.parts.slice(line.next, line.next + VOICE_LOOKAHEAD)) {
      if (!cache.has(part.text) && !queue.some((item) => item.text === part.text)) {
        queue.push({ ownerId: owner.ownerId, text: part.text, turn, cacheOnly: true });
      }
    }
    const reached = heard.progress * heard.text.length;
    while (line.next < line.parts.length && line.parts[line.next]!.start <= reached) {
      const result = cache.get(line.parts[line.next]!.text);
      if (!result) break;
      applyClassification(owner, result);
      line.next += 1;
    }
  };

  /** Runs once per frame time, however many avatars ask for a frame. */
  const tick = (nowMs: number) => {
    if (nowMs === lastTickMs) return;
    lastTickMs = nowMs;
    now = nowMs;
    if (arrived.length > 0) {
      const results = arrived;
      arrived = [];
      for (const { ownerId, turn: resultTurn, result } of results) {
        const owner = owners.get(ownerId);
        if (!owner || resultTurn !== turn) continue;
        // The voice brings the moods; the last one is kept for a voice that never plays.
        if (voice === "waiting") owner.held = result;
        else applyClassification(owner, result);
      }
    }
    if (replay) revealReplay(replay);
    if (dirty && (replyDone || now - lastReadAt >= T.readIntervalMs)) {
      dirty = false;
      lastReadAt = now;
      readReply();
    }
    for (const owner of owners.values()) {
      if (owner.gameSpeech) {
        const pending = owner.gameSpeech;
        // The first Game line can arrive through the feed before the first absolute RAF timestamp.
        pending.from ??= now;
        if (owner.audio?.isPlaying()) owner.gameSpeech = null;
        else if (now - pending.from >= (pending.pending ? T.voiceWaitMaxMs : T.voiceStartGraceMs)) {
          owner.clock.speakAll(pending.text, T.wholeSpeechMaxMs);
          owner.gameSpeech = null;
        }
      }
      if (owner.textTimeline && voice !== "waiting" && !owner.audio?.isPlaying()) {
        const timeline = owner.textTimeline;
        const progress = Math.min(1, (now - timeline.from) / Math.max(1, timeline.ms));
        followVoice(owner, { text: timeline.text, progress });
        if (progress >= 1 && owner.line?.next === owner.line?.parts.length) owner.textTimeline = null;
      }
      if (!owner.audio?.isPlaying()) continue;
      owner.textTimeline = null;
      owner.voiceAt = now;
      // Only this reading's voice ends the wait, not an earlier one still playing while this reply streams or loads.
      if (voice === "waiting" && voiceReadingId !== null && !owner.voiceStale) {
        owner.voicePlayed = true;
        voiceNewsAt = now;
      }
      // Game faces come from the Game Master's lines only.
      const heard = mode === "roleplay" ? owner.audio.line?.() : null;
      if (heard) followVoice(owner, heard);
    }
    if (voice === "waiting") checkVoice();
    if (
      heldPicks.size > 0 &&
      voice !== "waiting" &&
      !replay &&
      ![...owners.values()].some((owner) => owner.textTimeline)
    )
      applyHeldPicks();
    sendQueued();
    for (const owner of owners.values()) {
      if (owner.pending && now - owner.switchedAt >= T.minDwellMs) {
        const { emotion, weight, feeling } = owner.pending;
        switchTo(owner, emotion, weight, null, feeling ?? null);
      }
      if (owner.pendingFeeling && now - owner.feelingSwitchedAt >= T.minDwellMs) {
        owner.label = null;
        setFeeling(owner, owner.pendingFeeling);
      }
      if (mode !== "roleplay" || generating || replay || owner.settled || owner.speaking) continue;
      // While a reading is coming, a face holds until its voice has played, then relaxes after the voice.
      if (voice === "waiting" && !owner.voicePlayed) continue;
      if (owner.emotion === "neutral" && !owner.feeling) continue;
      const ended = Math.max(streamEndedAt ?? -Infinity, owner.voiceAt);
      if (ended === -Infinity) continue;
      const since = now - Math.max(ended, owner.switchedAt) - T.settleAfterMs;
      if (since < 0) continue;
      if (owner.emotion === "neutral") {
        // A calm face with a feeling (curiosity) relaxes to the plain one; the emotion and its weight stay as they are.
        if (since >= T.decayMs) setFeeling(owner, null);
        continue;
      }
      owner.decayFrom ??= owner.weight;
      owner.weight = owner.decayFrom * Math.max(0, 1 - since / T.decayMs);
      if (since >= T.decayMs) switchTo(owner, "neutral", 1, null);
    }
  };

  const stateOf = (owner: OwnerState): AvatarState => {
    if (owner.speaking) return "talking";
    const waiting = mode === "game" ? !lineShownThisTurn : !streamStarted;
    const expected =
      expectedSpeakerId === null || !owners.has(expectedSpeakerId) || expectedSpeakerId === owner.ownerId;
    if (generating && waiting && expected && !owner.isPersona) return "thinking";
    const othersTalking = [...owners.values()].some((other) => other !== owner && other.speaking);
    if (othersTalking || (userTyping && !owner.isPersona)) return "listening";
    return "idle";
  };

  const director: AvatarDirector = {
    setParticipants(participants) {
      const previous = new Map(owners);
      owners.clear();
      for (const participant of participants) {
        const existing = previous.get(participant.owner.ownerId);
        if (existing) {
          existing.name = participant.name;
          existing.isPersona = participant.owner.ownerType === "persona";
        }
        owners.set(participant.owner.ownerId, existing ?? newOwner(participant));
      }
      for (const owner of owners.values()) {
        const source = audioSources.get(owner.ownerId);
        if (source && owner.audio !== source) director.setAudioSource(owner.ownerId, source);
      }
      // Game lines once there is someone to give them to: the line already on screen arrives right away.
      if (mode === "game" && !gameLinesSubscribed && !disposed) {
        gameLinesSubscribed = true;
        unsubscribers.push(
          subscribeAvatarGameLines((lineChatId, line) => {
            if (lineChatId === chatId) director.pushGameLine(line);
          }),
        );
      }
    },
    pushStreamText(update: AvatarStreamUpdate) {
      if (update.chatId !== chatId || mode !== "roleplay") return;
      if (/\S/u.test(update.text)) {
        // New text while the generation runs means the reply goes on (the next group speaker, or the typewriter still
        // showing it). After the generation ends it is a late rewrite of the finished reply, read as finished.
        if (replyDone && generating && latest && update.text !== latest.text) replyDone = false;
        // A late rewrite while the text animation replays: read the new text as finished.
        if (replay) finishReplay();
        latest = { text: update.text, speakerId: update.speakerOwnerId };
        streamStarted = true;
        dirty = true;
      } else if (generating && !replyDone) {
        // A cleared buffer mid-generation: the next speaker is thinking until their first word.
        streamStarted = false;
      }
      if (update.done) finishReply();
    },
    pushExpressionPicks(picks: readonly AvatarExpressionPick[]) {
      for (const pick of picks) {
        const owner = owners.get(pick.ownerId) ?? ownerByName(pick.ownerId);
        if (!owner) continue;
        // The voice (or the replayed text) still has moods to show: the pick is the face after them.
        if (voice === "waiting" || replay || owner.textTimeline) heldPicks.set(owner.ownerId, pick.expression);
        else {
          switchToLabel(owner, pick.expression);
          owner.settled = true;
        }
      }
    },
    pushGameLine(line: AvatarGameLine) {
      if (mode !== "game") return;
      lineShownThisTurn = true;
      const previousLineId = shownGameLineId;
      if (line.id === undefined || line.id !== shownGameLineId) {
        for (const participant of owners.values()) {
          participant.gameSpeech = null;
          participant.gameVoiceLineId = null;
          participant.clock.clear();
        }
      }
      shownGameLineId = line.id;
      const owner = (line.ownerId ? owners.get(line.ownerId) : null) ?? ownerByName(line.speakerName);
      if (!owner) return;
      if (line.expression) switchToLabel(owner, line.expression);
      const text = cleanTTSInputText(line.text);
      if (owner.audio?.isPlaying()) {
        if (previousLineId === undefined || previousLineId === line.id) owner.gameVoiceLineId = line.id;
        owner.gameSpeech = null;
        return;
      }
      if (!text || owner.gameVoiceLineId === line.id) {
        owner.gameSpeech = null;
        return;
      }
      if ((line.voiceExpected ?? voiceAutoplay) && !owner.isPersona) {
        const previous = owner.gameSpeech;
        const pending = line.voicePending === true;
        owner.clock.clear();
        owner.gameSpeech = {
          id: line.id,
          text,
          from: previous && previous.id === line.id && previous.pending === pending ? previous.from : null,
          pending,
        };
      } else {
        owner.gameSpeech = null;
        owner.clock.speakAll(text, T.wholeSpeechMaxMs);
      }
    },
    setAudioSource(ownerId: string, source: AvatarAudioLevelSource | null) {
      if (source) audioSources.set(ownerId, source);
      else audioSources.delete(ownerId);
      const owner = owners.get(ownerId);
      if (!owner) return;
      owner.audio = source;
      if (source && mode === "game") {
        owner.gameVoiceLineId = owner.gameSpeech?.id ?? shownGameLineId;
        owner.gameSpeech = null;
      }
      // The voice that was playing stopped or moved on; the next one belongs to the reading now announced.
      owner.voiceStale = false;
      if (source) owner.clock.clear();
    },
    setVoiceAutoplay(on: boolean) {
      voiceAutoplay = on;
    },
    setUserTyping(typing: boolean) {
      userTyping = typing;
    },
    frame(ownerId: string, nowMs: number): AvatarFrameInput {
      tick(nowMs);
      const owner = owners.get(ownerId);
      if (!owner) return { ...AVATAR_NEUTRAL_FRAME };
      const dt = owner.lastFrameMs === null ? 0 : Math.max(0, nowMs - owner.lastFrameMs);
      owner.lastFrameMs = nowMs;
      const speech = owner.clock.sample(nowMs);
      let mouthOpen = speech.open;
      let viseme = speech.viseme;
      owner.speaking = speech.speaking;
      if (owner.audio?.isPlaying()) {
        owner.audioOpen = followMouthEnvelope(owner.audioOpen, clamp01(owner.audio.level()), dt);
        mouthOpen = owner.audioOpen;
        viseme = owner.audioOpen > 0.05 ? (owner.audio.viseme?.() ?? "aa") : null;
        owner.speaking = true;
      } else {
        owner.audioOpen = 0;
      }
      return {
        emotion: owner.emotion,
        emotionWeight: owner.weight,
        label: owner.label,
        feeling: owner.feeling,
        viseme,
        mouthOpen,
        state: stateOf(owner),
      };
    },
    dispose() {
      disposed = true;
      inFlight?.abort();
      inFlight = null;
      queue = [];
      arrived = [];
      for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
      audioSources.clear();
    },
  };

  // ── Feeds ──
  let lastStoreText: string | null = null;
  const readChatStore = (state: ReturnType<typeof useChatStore.getState>) => {
    const active = state.activeChatId === chatId;
    const busy = state.abortControllers.has(chatId);
    if (busy || state.streamingChatId === chatId) expectedSpeakerId = state.streamingCharacterId;
    setGenerating(busy);
    const streamedMessageId = state.streamedMessageIds.get(chatId);
    if (busy && streamedMessageId) replyMessageIds.add(streamedMessageId);
    const text = state.streamBuffers.get(chatId) ?? (active ? state.streamBuffer : "");
    if (text !== lastStoreText) {
      lastStoreText = text;
      director.pushStreamText({
        chatId,
        messageId: state.streamedMessageIds.get(chatId) ?? null,
        text,
        speakerOwnerId: state.streamingCharacterId,
        done: false,
      });
    }
    director.setUserTyping(active && state.hasCurrentInput);
  };
  readChatStore(useChatStore.getState());
  unsubscribers.push(useChatStore.subscribe(readChatStore));

  // The Expression Engine's post-reply pick (only stored for the chat on screen). In Roleplay the composer is free
  // while post-processing runs, so a pick can land after the next message was sent: it counts for the latest
  // reply's rows, and otherwise only while no generation runs and no reply has been seen yet.
  const ownsPick = (messageId: string | null | undefined) =>
    messageId ? replyMessageIds.has(messageId) || (!generating && replyMessageIds.size === 0) : !generating;
  const seenResults = new Map(useAgentStore.getState().lastResults);
  unsubscribers.push(
    useAgentStore.subscribe((state) => {
      for (const [key, result] of state.lastResults) {
        if (seenResults.get(key) === result) continue;
        seenResults.set(key, result);
        if (!result.success || result.type !== "sprite_change") continue;
        if (useChatStore.getState().activeChatId !== chatId) continue;
        if (mode === "roleplay" && !ownsPick(result.messageId)) continue;
        const expressions = (result.data as { expressions?: unknown } | null)?.expressions;
        if (!Array.isArray(expressions)) continue;
        director.pushExpressionPicks(
          expressions.flatMap((entry: { characterId?: unknown; expression?: unknown } | null) =>
            typeof entry?.characterId === "string" && typeof entry.expression === "string"
              ? [{ ownerId: entry.characterId, expression: entry.expression }]
              : [],
          ),
        );
      }
    }),
  );

  if (typeof window !== "undefined") {
    const onMessageReady = (event: Event) => {
      const detail = (event as CustomEvent<TTSAutoplayMessageReadyDetail>).detail;
      if (detail?.chatId !== chatId || mode !== "roleplay") return;
      const parts = [...(detail.earlierMessages ?? []), detail.message];
      for (const part of parts) replyMessageIds.add(part.id);
      // Streaming: the typewriter may still be showing the reply. It ends when the generation does.
      if (!wholeReply) return;
      // Streaming is off: the reply shows whole. Read it at once and speak its dialogue within 8 s. A Merged group
      // reply is saved under its first character, so there each paragraph goes to the character it names.
      director.pushStreamText({
        chatId,
        messageId: detail.message.id,
        text: parts.map((part) => part.content).join("\n\n"),
        speakerOwnerId: messageSpeakerIsReliable(chatId, characters().length)
          ? (detail.message.characterId ?? null)
          : null,
        done: true,
      });
    };
    window.addEventListener(TTS_AUTOPLAY_MESSAGE_READY_EVENT, onMessageReady);
    unsubscribers.push(() => window.removeEventListener(TTS_AUTOPLAY_MESSAGE_READY_EVENT, onMessageReady));

    // Auto-play reads a reply: wait for its voice (also when the reply began before auto-play was known, or in a
    // group, for the next member's reply), until that reading ends.
    const onVoice = (event: Event) => {
      const detail = (event as CustomEvent<TTSAutoplayVoiceDetail>).detail;
      if (detail?.chatId !== chatId || mode !== "roleplay") return;
      if (detail.pending) {
        if (replay) return;
        voice = "waiting";
        voiceReadingId = detail.readingId;
        // A voice playing now is an earlier reading's: this reading stops it before its own voice plays.
        for (const owner of owners.values()) owner.voiceStale = owner.audio !== null;
        voicePending = true;
        voiceNewsAt = now;
        replyMessageIds.add(detail.messageId);
      } else if (detail.readingId === voiceReadingId) {
        voicePending = false;
      }
    };
    window.addEventListener(TTS_AUTOPLAY_VOICE_EVENT, onVoice);
    unsubscribers.push(() => window.removeEventListener(TTS_AUTOPLAY_VOICE_EVENT, onVoice));
  }

  unsubscribers.push(subscribeAvatarAudio((ownerId, source) => director.setAudioSource(ownerId, source)));

  // An avatar agent is on in this Roleplay chat: the server downloads (once) and loads its local model now.
  askForModel();

  return director;
}
