/**
 * Avatar lip sync from text-to-speech (epic #7537, lane TTS):
 *   - a clip's loudness track opens the mouth on speech, keeps it shut on silence and low noise, opens fast,
 *     closes smoothly, and guesses a coarse mouth shape from how bright the sound is;
 *   - the real TTS service publishes a level source for the character whose voice reads each line (with the
 *     line's text and how far through the clip the voice is, for the avatar's moods), swaps it
 *     between speakers, withdraws it on narration, pause, stop and chat switch, and attributes a reading to
 *     the chat it was requested in, even when the user switches chats while it loads or a stage mounts later;
 *   - the voice never passes through Web Audio: no AudioContext is created and playback is untouched, so the
 *     Safari/iOS autoplay handling keeps working; an undecodable clip simply gives no level;
 *   - the TTS request builders carry the character their voice lookup resolved, without changing cache keys.
 * Web Audio, the audio element and fetch are stubbed; nothing plays and no provider is called.
 */
import assert from "node:assert/strict";
import type { AvatarAudioLevelSource } from "../../packages/client/src/features/avatars/contract.js";
import type { VoiceSamples } from "../../packages/client/src/features/avatars/audio/voice-envelope.js";

type ToneSpec = Array<{ seconds: number; hz: number; amp: number }>;

function toneSamples(parts: ToneSpec, sampleRate = 16_000): VoiceSamples {
  const total = parts.reduce((sum, part) => sum + Math.round(part.seconds * sampleRate), 0);
  const data = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    const count = Math.round(part.seconds * sampleRate);
    for (let index = 0; index < count; index += 1) {
      data[offset + index] = part.amp * Math.sin((2 * Math.PI * part.hz * index) / sampleRate);
    }
    offset += count;
  }
  return { sampleRate, numberOfChannels: 1, length: total, getChannelData: () => data };
}

// ── Stubs: installed before the modules load, because the decoder is created once and kept ──
let realtimeContexts = 0;
let decodes = 0;
const fetchedTexts: string[] = [];
/** While set, voice requests wait for it, like a slow provider. */
let fetchGate: Promise<void> | null = null;
let decodeGate: Promise<void> | null = null;
class ForbiddenAudioContext {
  constructor() {
    realtimeContexts += 1;
    throw new Error("lip sync must not create a realtime AudioContext");
  }
}
class FakeOfflineAudioContext {
  constructor(
    _channels: number,
    _length: number,
    readonly sampleRate: number,
  ) {}
  async decodeAudioData(bytes: ArrayBuffer): Promise<VoiceSamples> {
    decodes += 1;
    if (decodeGate) await decodeGate;
    return toneSamples(JSON.parse(new TextDecoder().decode(bytes)) as ToneSpec, this.sampleRate);
  }
}
class FakeAudio extends EventTarget {
  src = "";
  volume = 1;
  muted = false;
  paused = true;
  ended = false;
  currentTime = 0;
  duration = 0.5;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play() {
    this.paused = false;
    this.ended = false;
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  load() {}
}
const CLIPS: Record<string, string> = {
  dottore: JSON.stringify([
    { seconds: 0.1, hz: 0, amp: 0 },
    { seconds: 0.4, hz: 300, amp: 0.5 },
  ]),
  narration: JSON.stringify([{ seconds: 0.5, hz: 900, amp: 0.5 }]),
  mari: JSON.stringify([{ seconds: 0.5, hz: 900, amp: 0.5 }]),
  broken: "not audio",
};
const previous = {
  Audio: Object.getOwnPropertyDescriptor(globalThis, "Audio"),
  AudioContext: Object.getOwnPropertyDescriptor(globalThis, "AudioContext"),
  OfflineAudioContext: Object.getOwnPropertyDescriptor(globalThis, "OfflineAudioContext"),
  fetch: globalThis.fetch,
};
Object.defineProperty(globalThis, "Audio", { configurable: true, value: FakeAudio });
Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: ForbiddenAudioContext });
Object.defineProperty(globalThis, "OfflineAudioContext", { configurable: true, value: FakeOfflineAudioContext });
globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
  const { text } = JSON.parse(String(init?.body)) as { text: string };
  fetchedTexts.push(text);
  if (fetchGate) await fetchGate;
  return new Response(new Blob([CLIPS[text] ?? "[]"]), { headers: { "Content-Type": "audio/wav" } });
}) as typeof fetch;

const { computeVoiceEnvelope, voiceLevelAt, voiceVisemeAt } =
  await import("../../packages/client/src/features/avatars/audio/voice-envelope.js");
const { subscribeAvatarAudio, prepareAvatarAudioBlob, setGameVoicePlayback } =
  await import("../../packages/client/src/features/avatars/audio/avatar-audio.js");
const { ttsService } = await import("../../packages/client/src/lib/tts-service.js");
const { useChatStore } = await import("../../packages/client/src/stores/chat.store.js");
const { buildTTSVoiceRequests, withTTSVoiceRequestCacheKeys } =
  await import("../../packages/client/src/lib/tts-dialogue.js");
const { buildExtractedRoleplayTTSVoiceRequests } =
  await import("../../packages/client/src/lib/tts-roleplay-speaker-extractor.js");
const { withRoleplayTTSParagraphs } = await import("../../packages/client/src/lib/roleplay-vn-tts.js");
const { ttsConfigSchema } = await import("../../packages/shared/src/index.js");

async function until(condition: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(`timed out waiting for: ${label}`);
}

try {
  // ── Loudness track ──
  {
    const envelope = computeVoiceEnvelope(
      toneSamples([
        { seconds: 0.2, hz: 0, amp: 0 },
        { seconds: 0.4, hz: 300, amp: 0.5 },
        { seconds: 0.2, hz: 0, amp: 0 },
        { seconds: 0.2, hz: 3000, amp: 0.2 },
      ]),
    );
    assert.equal(voiceLevelAt(envelope, 0.1), 0, "silence keeps the mouth shut");
    assert.equal(voiceVisemeAt(envelope, 0.1), null);
    assert.ok(voiceLevelAt(envelope, 0.25) > 0.8, "the mouth opens within a few frames of speech");
    assert.ok(voiceLevelAt(envelope, 0.4) > 0.95, "the loud parts of a clip open the mouth fully");
    assert.equal(voiceVisemeAt(envelope, 0.4), "ou", "a dark sound rounds the lips");
    const closing = voiceLevelAt(envelope, 0.61);
    assert.ok(closing > 0.4 && closing < 0.9, `the mouth closes smoothly, not at once (${closing})`);
    assert.equal(voiceVisemeAt(envelope, 0.61), "ou", "a closing mouth keeps the shape of the last sound");
    assert.ok(voiceLevelAt(envelope, 0.78) < 0.1, "and is nearly shut a moment later");
    const quiet = voiceLevelAt(envelope, 0.95);
    assert.ok(quiet > 0.15 && quiet < 0.5, `a quieter part opens the mouth less (${quiet})`);
    assert.equal(voiceVisemeAt(envelope, 0.95), "ih", "a bright sound shows the teeth");
    assert.equal(voiceLevelAt(envelope, 1.5), 0, "nothing after the clip ends");
    assert.equal(voiceLevelAt(envelope, -1), 0);

    const open = computeVoiceEnvelope(toneSamples([{ seconds: 0.3, hz: 900, amp: 0.4 }]));
    assert.equal(voiceVisemeAt(open, 0.2), "aa", "a mid sound opens the mouth");

    const gated = computeVoiceEnvelope(
      toneSamples([
        { seconds: 0.4, hz: 300, amp: 0.5 },
        { seconds: 0.4, hz: 300, amp: 0.04 },
      ]),
    );
    assert.equal(voiceLevelAt(gated, 0.79), 0, "low background noise is gated out");

    const silent = computeVoiceEnvelope(toneSamples([{ seconds: 0.5, hz: 0, amp: 0 }]));
    assert.ok(
      silent.levels.every((level) => level === 0),
      "a silent clip, like the priming clip, never moves the mouth",
    );
  }

  // ── Request builders carry the character their voice lookup resolved ──
  {
    const config = ttsConfigSchema.parse({ source: "openai", voice: "alloy" });
    const [line] = buildTTSVoiceRequests("Hello there.", config, "Dottore", "dottore-id");
    assert.equal(line?.characterId, "dottore-id", "a character's message is read in that character's voice");
    const [narration] = buildTTSVoiceRequests("The wind howls.", config, "Narrator", null);
    assert.equal(narration?.characterId, undefined, "narration belongs to no character");

    const characterIds: Record<string, string> = { Dottore: "dottore-id", Mari: "mari-id" };
    const extracted = buildExtractedRoleplayTTSVoiceRequests(
      [
        { kind: "narration", text: "Dottore sighs." },
        { kind: "dialogue", speaker: "Dottore", text: '"Enough of this."' },
        { kind: "dialogue", speaker: "Mari", text: '"Skill issue."' },
        { kind: "dialogue", speaker: "Fatui Guard", text: '"At once."' },
      ],
      config,
      "Dottore",
      "dottore-id",
      (speaker) => characterIds[speaker ?? ""],
    );
    assert.deepEqual(
      extracted.map(({ speaker, characterId }) => [speaker, characterId]),
      [
        ["Narrator", undefined],
        ["Dottore", "dottore-id"],
        ["Mari", "mari-id"],
        ["Fatui Guard", undefined],
      ],
      "each extracted speaker keeps the character the voice lookup found",
    );
    const content = "Dottore sighs.\n\nMari laughs.";
    const paragraphs = withRoleplayTTSParagraphs(
      buildTTSVoiceRequests(content, config, "Dottore", "dottore-id"),
      content,
      config,
    );
    assert.ok(
      paragraphs.length > 0 && paragraphs.every((request) => request.characterId === "dottore-id"),
      "Roleplay VN paragraphs keep the speaking character",
    );
    const { characterId: _characterId, ...withoutCharacter } = line!;
    assert.equal(
      withTTSVoiceRequestCacheKeys([line!], config, "message-1")[0]?.cacheKey,
      withTTSVoiceRequestCacheKeys([withoutCharacter], config, "message-1")[0]?.cacheKey,
      "voice lines cached before this change still replay from the cache",
    );
  }

  // ── Level sources follow the real TTS service ──
  {
    useChatStore.setState({ activeChatId: "chat-a" });
    const events: Array<[string, AvatarAudioLevelSource | null]> = [];
    const unsubscribe = subscribeAvatarAudio((ownerId, source) => events.push([ownerId, source]));
    assert.deepEqual(events, [], "nothing is published while no voice plays");

    const reading = ttsService.speakSequence(
      [
        { text: "dottore", speaker: "Dottore", characterId: "dottore-id" },
        { text: "narration", speaker: "Narrator" },
        { text: "mari", speaker: "Mari", characterId: "mari-id" },
      ],
      "message-1",
      { chatId: "chat-a" },
    );
    await until(() => events.length === 1, "Dottore's line starts");
    const element = ttsService.getPlayback()?.element as unknown as FakeAudio;
    const [dottoreOwner, dottore] = events[0]!;
    assert.equal(dottoreOwner, "dottore-id");
    assert.ok(dottore, "the speaking character gets a level source");
    element.currentTime = 0.3;
    await until(() => dottore.viseme?.() === "ou", "Dottore's clip decodes");
    element.currentTime = 0.05;
    assert.equal(dottore.level(), 0, "the silent lead-in keeps the mouth shut");
    element.currentTime = 0.3;
    assert.ok(dottore.level() > 0.9, "the level follows the playback position");
    assert.equal(dottore.viseme?.(), "ou");
    // The 0.5 s clip at 0.3 s: its text, and how far through it the voice is, for the avatar's moods.
    const line = dottore.line?.();
    assert.equal(line?.text, "dottore", "the line is the text the clip reads");
    assert.ok(Math.abs(line!.progress - 0.6) < 0.01, `progress follows the playback position (${line?.progress})`);
    element.currentTime = 9;
    assert.equal(dottore.line?.()?.progress, 1, "progress stops at the end of the clip");
    element.currentTime = 0.3;

    element.ended = true;
    element.onended?.();
    assert.equal(dottore.isPlaying(), false, "a finished line reports no voice before the next one starts");
    await until(() => events.length === 2, "the narrator's line starts");
    assert.deepEqual(events[1], ["dottore-id", null], "narration moves no mouth");
    assert.equal(dottore.level(), 0);
    assert.equal(dottore.line?.(), null, "nor gives a line to a withdrawn source");

    element.ended = true;
    element.onended?.();
    await until(() => events.length === 3, "Mari's line starts");
    const [mariOwner, mari] = events[2]!;
    assert.equal(mariOwner, "mari-id", "the next speaker gets the voice");
    await until(() => mari?.isPlaying() === true, "Mari's clip decodes");
    element.currentTime = 0.2;
    assert.ok(mari!.level() > 0.9);
    assert.equal(mari!.viseme?.(), "aa");

    ttsService.pause();
    assert.deepEqual(events[3], ["mari-id", null], "pausing withdraws the voice");
    assert.equal(mari!.isPlaying(), false);
    ttsService.resume();
    await until(() => events.length === 5, "resuming publishes again");
    assert.equal(events[4]![0], "mari-id");
    const resumed = events[4]![1]!;
    assert.equal(mari!.isPlaying(), false, "an old source stays silent once replaced");

    useChatStore.setState({ activeChatId: "chat-b" });
    assert.deepEqual(events[5], ["mari-id", null], "switching chats withdraws the voice");
    assert.equal(resumed.isPlaying(), false);
    useChatStore.setState({ activeChatId: "chat-a" });
    assert.equal(events[6]?.[0], "mari-id", "coming back to the chat that is being read restores it");

    const decodesBeforeRestart = decodes;
    ttsService.restart();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(decodes, decodesBeforeRestart, "replaying a clip reuses its loudness track");

    element.ended = true;
    element.onended?.();
    await reading;
    assert.deepEqual(events.at(-1), ["mari-id", null], "the end of the reading withdraws the voice");

    // A reading started in another chat belongs to that chat.
    useChatStore.setState({ activeChatId: "chat-b" });
    const countBefore = events.length;
    void ttsService.speak("dottore", "message-2", { chatId: "chat-b", characterId: "dottore-id" });
    await until(() => events.length === countBefore + 1, "a reading in chat B starts");
    assert.equal(events.at(-1)?.[0], "dottore-id");
    ttsService.stop();
    assert.deepEqual(events.at(-1), ["dottore-id", null], "stopping withdraws the voice");

    // Switching chats while the voice still loads: the reading stays with the chat it was requested in.
    useChatStore.setState({ activeChatId: "chat-a" });
    let releaseFetch = () => {};
    fetchGate = new Promise<void>((resolve) => (releaseFetch = resolve));
    const countBeforeLoading = events.length;
    const loading = ttsService.speakSequence(
      [{ text: "dottore", speaker: "Dottore", characterId: "dottore-id" }],
      "message-5",
      { chatId: "chat-a" },
    );
    assert.equal(ttsService.getState(), "loading");
    useChatStore.setState({ activeChatId: "chat-b" });
    fetchGate = null;
    releaseFetch();
    await until(() => ttsService.getState() === "playing", "chat A's voice starts while chat B is open");
    assert.equal(events.length, countBeforeLoading, "chat B's avatars stay still for chat A's voice");
    useChatStore.setState({ activeChatId: "chat-a" });
    assert.equal(events.at(-1)?.[0], "dottore-id", "chat A's avatar follows its own voice when the user comes back");
    assert.ok(events.at(-1)?.[1]);
    ttsService.stop();
    await loading;

    // An undecodable clip still plays; the avatar just gets no level.
    void ttsService.speak("broken", "message-3", { chatId: "chat-a", characterId: "dottore-id" });
    await until(() => ttsService.getState() === "playing" && events.at(-1)?.[1] != null, "the broken clip plays");
    const broken = events.at(-1)![1]!;
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(broken.isPlaying(), false, "no loudness track means no level, not a stuck mouth");
    assert.equal(broken.level(), 0);
    assert.equal(ttsService.getState(), "playing", "the voice itself keeps playing");
    ttsService.stop();

    // A reading with no chat, like the voice preview in settings, moves no mouth.
    const countBeforePreview = events.length;
    void ttsService.speak("dottore", "tts-preview", { characterId: "dottore-id" });
    await until(() => ttsService.getState() === "playing", "a reading with no chat plays");
    assert.equal(events.length, countBeforePreview, "a reading with no chat moves no avatar");
    ttsService.stop();

    unsubscribe();
    const countAfterUnsubscribe = events.length;
    void ttsService.speak("dottore", "message-4", { chatId: "chat-a", characterId: "dottore-id" });
    await until(() => ttsService.getState() === "playing", "playback without listeners");
    assert.equal(events.length, countAfterUnsubscribe, "nothing is published once the director unsubscribes");

    // A stage that mounts in another chat while chat A's voice plays stays still; chat A's stage follows it.
    useChatStore.setState({ activeChatId: "chat-b" });
    const lateEvents: Array<[string, AvatarAudioLevelSource | null]> = [];
    const unsubscribeLate = subscribeAvatarAudio((ownerId, source) => lateEvents.push([ownerId, source]));
    assert.deepEqual(lateEvents, [], "a stage mounted in another chat does not take chat A's voice");
    useChatStore.setState({ activeChatId: "chat-a" });
    assert.equal(lateEvents.at(-1)?.[0], "dottore-id", "the chat being read follows the voice");
    unsubscribeLate();
    ttsService.stop();

    assert.equal(realtimeContexts, 0, "playback never goes through a realtime AudioContext");
    assert.ok(decodes >= 3, "each clip is decoded on the side");
    assert.ok(fetchedTexts.length >= 5);
  }

  {
    useChatStore.setState({ activeChatId: "game-a" });
    const events: Array<[string, AvatarAudioLevelSource | null]> = [];
    const stop = subscribeAvatarAudio((id, source) => events.push([id, source]));
    const before = decodes;
    const prepared = await ttsService.generateAudio("mari");
    await until(() => decodes > before, "a newly generated Blob pre-decodes before playback");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const warmedDecodes = decodes;
    const audio = new FakeAudio();
    const playback = {
      element: audio as unknown as HTMLAudioElement,
      blob: prepared,
      chatId: "game-a",
      characterId: "mari-id",
      text: "Ah, hello.",
    };
    setGameVoicePlayback(playback);
    assert.equal(events.length, 0, "a Game source is not published before audio plays");
    await audio.play();
    const warm = events.at(-1)![1]!;
    audio.currentTime = 0.08;
    assert.ok(warm.level() > 0.9, "a warmed clip has an envelope from its first spoken frames");
    assert.equal(decodes, warmedDecodes, "playback reuses pre-decoding");
    const { createAvatarDirector } =
      await import("../../packages/client/src/features/avatars/director/avatar-director.js");
    const mounted = createAvatarDirector({ chatId: "game-a", mode: "game", reducedMotion: false });
    mounted.setParticipants([{ owner: { ownerType: "character", ownerId: "mari-id" }, name: "Mari" }]);
    mounted.frame("mari-id", 120_000);
    assert.ok(
      mounted.frame("mari-id", 120_080).mouthOpen > 0.7,
      "a stage mounted mid-voice hydrates audio after participants register",
    );
    mounted.dispose();
    audio.pause();
    assert.equal(events.at(-1)![1], null, "pausing Game withdraws its source");
    await audio.play();
    assert.ok(events.at(-1)![1], "resuming Game publishes again");
    useChatStore.setState({ activeChatId: "other-game" });
    assert.equal(events.at(-1)![1], null, "a different Game chat cannot take the voice");
    useChatStore.setState({ activeChatId: "game-a" });
    assert.ok(events.at(-1)![1]);

    let releaseDecode = () => {};
    decodeGate = new Promise<void>((resolve) => (releaseDecode = resolve));
    const pendingBlob = new Blob([CLIPS.mari!]);
    const next = new FakeAudio();
    setGameVoicePlayback({ ...playback, element: next as unknown as HTMLAudioElement, blob: pendingBlob });
    await next.play();
    const pending = events.at(-1)![1]!;
    next.currentTime = 0.08;
    assert.ok(pending.isPlaying() && pending.level() > 0.1, "pending decoding uses the spoken text immediately");
    assert.equal(pending.line?.()?.text, "Ah, hello.");
    setGameVoicePlayback(null, audio as unknown as HTMLAudioElement);
    assert.ok(pending.isPlaying(), "a stale clip cannot clear its replacement");
    decodeGate = null;
    releaseDecode();
    await until(() => pending.viseme?.() === "aa", "the decoded envelope takes over");
    next.ended = true;
    next.dispatchEvent(new Event("ended"));
    assert.equal(events.at(-1)![1], null, "Game end withdraws the source");
    setGameVoicePlayback(null, next as unknown as HTMLAudioElement);
    stop();
    const withoutAvatars = decodes;
    await ttsService.generateAudio("mari");
    prepareAvatarAudioBlob(new Blob([CLIPS.mari!]));
    const unattended = new FakeAudio();
    setGameVoicePlayback({
      ...playback,
      element: unattended as unknown as HTMLAudioElement,
      blob: new Blob([CLIPS.mari!]),
    });
    await unattended.play();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(decodes, withoutAvatars, "no avatar listeners means no pre-decoding");
    setGameVoicePlayback(null, unattended as unknown as HTMLAudioElement);
    console.info(
      "Clip start proof: text mouth open at 80 ms while decode is held; warmed clip audio envelope ready at 80 ms",
    );
  }
} finally {
  setGameVoicePlayback(null);
  ttsService.stop();
  globalThis.fetch = previous.fetch;
  for (const name of ["Audio", "AudioContext", "OfflineAudioContext"] as const) {
    const descriptor = previous[name];
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
