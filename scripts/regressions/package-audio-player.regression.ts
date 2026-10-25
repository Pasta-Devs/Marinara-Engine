// Drives the actual shared player: independent ownership, autoplay retry teardown,
// late completion and permanent disposal must not stop the reusable Game singleton.
import assert from "node:assert/strict";
import { mock } from "node:test";
import { setImmediate as flushTasks } from "node:timers/promises";

const listeners = new Map<string, Set<() => void>>();
const elements: AudioStub[] = [];
class AudioStub {
  preload = "";
  muted = false;
  volume = 1;
  loop = false;
  src: string;
  currentTime = 0;
  paused = true;
  playCount = 0;
  onerror: (() => void) | null = null;
  onended: (() => void) | null = null;
  constructor(src = "") {
    this.src = src;
    elements.push(this);
  }
  play() {
    this.playCount++;
    if (this.src.includes("blocked")) return Promise.reject(new DOMException("Gesture required", "NotAllowedError"));
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  addEventListener() {}
  removeEventListener() {}
}
const windowStub: { AudioContext?: unknown } = {};
Object.assign(globalThis, {
  Audio: AudioStub,
  window: windowStub,
  document: {
    addEventListener(event: string, handler: () => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    removeEventListener(event: string, handler: () => void) {
      listeners.get(event)?.delete(handler);
    },
  },
});
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const listenerCount = () => [...listeners.values()].reduce((count, set) => count + set.size, 0);
const gesture = () => {
  for (const handler of [...(listeners.get("click") ?? [])]) handler();
};
const active = (suffix: string) => elements.filter((element) => element.src.endsWith(suffix) && !element.paused);
const assets = { first: { path: "music/first.mp3" }, second: { path: "music/second.mp3" } };
const { createAudioPlayer, audioManager } = await import("../../packages/client/src/lib/game-audio.js");
const { selectDefaultMusic } = await import("../../packages/client/src/lib/audio-service.js");

const baseline = listenerCount();
const first = createAudioPlayer();
const second = createAudioPlayer();
assert.equal(listenerCount(), baseline + 8);
first.playMusic("first", assets);
first.dispose();
first.dispose();
assert.equal(listenerCount(), baseline + 4, "unmount before the first gesture removes only the owner's listeners");
second.playMusic("second", assets);
gesture();
await tick();
assert.equal(active("first.mp3").length, 0, "disposed pending music cannot revive on a later gesture");
assert.equal(active("second.mp3").length, 1);
audioManager.playMusic("first", assets);
await tick();
assert.equal(active("first.mp3").length, 1);
second.setVolumes({ music: 0.2, sfx: 0.3 });
second.setMuted(true);
assert.equal(active("second.mp3")[0]!.muted, true);
assert.equal(active("first.mp3")[0]!.muted, false, "package mute does not mutate Game playback");
assert.equal(audioManager.getState().musicVolume, 0.5);
second.dispose();
assert.equal(active("second.mp3").length, 0);
assert.equal(active("first.mp3").length, 1, "package disposal does not stop Game");

const afterGesture = createAudioPlayer();
assert.equal(listenerCount(), 0, "a new package inherits an already-observed page gesture");
afterGesture.playMusic("second", assets);
await tick();
assert.equal(active("second.mp3").length, 1);
afterGesture.dispose();
afterGesture.unlock();
afterGesture.playMusic("second", assets);
afterGesture.playSfx("second", assets);
afterGesture.setVolumes({ music: 1, sfx: 1 });
afterGesture.setMuted(false);
await tick();
assert.equal(active("second.mp3").length, 0, "every disposed facade remains inert");

const blocked = createAudioPlayer();
blocked.playMusic("blocked", { blocked: { path: "music/blocked.mp3" } });
await tick();
assert.equal(listenerCount(), 4, "autoplay refusal registers an owned retry");
blocked.dispose();
assert.equal(listenerCount(), 0, "permanent teardown removes autoplay retry listeners too");
gesture();
assert.equal(listenerCount(), 0);

const late = createAudioPlayer();
late.playMusic("second", assets);
late.dispose();
await tick();
assert.equal(active("second.mp3").length, 0, "late readiness cannot restart a disposed player");

audioManager.dispose();
windowStub.AudioContext = class {
  constructor() {
    throw new DOMException("Audio contexts unavailable", "NotSupportedError");
  }
};
const refusedContext = createAudioPlayer();
refusedContext.playMusic("blocked", { blocked: { path: "music/blocked.mp3" } });
await tick();
assert.equal(listenerCount(), 4, "a refused playback still registers its gesture retry");
refusedContext.playMusic("second", assets);
await tick();
assert.doesNotThrow(gesture, "a refused AudioContext cannot escape the document gesture handler");
await tick();
assert.equal(listenerCount(), 0, "a refused AudioContext does not strand interaction listeners");
assert.equal(active("second.mp3").length, 1, "music falls back to a media element when context construction fails");
refusedContext.dispose();
assert.equal(active("second.mp3").length, 0);
delete windowStub.AudioContext;
const originalFetch = globalThis.fetch;
const contexts: ContextStub[] = [];
class GainStub {
  value = 1;
  disconnected = false;
  constructor(readonly context: ContextStub) {}
  gain = {
    setValueAtTime: (value: number, time: number) => {
      assert.equal(time, this.context.currentTime);
      this.value = value;
    },
  };
  connect() {}
  disconnect() {
    this.disconnected = true;
  }
}
class SourceStub {
  buffer: { url: string } | null = null;
  loop = false;
  starts = 0;
  stops = 0;
  disconnected = false;
  gain: GainStub | null = null;
  connect(target: unknown) {
    if (target instanceof GainStub) this.gain = target;
  }
  start() {
    this.starts++;
  }
  stop() {
    this.stops++;
  }
  disconnect() {
    this.disconnected = true;
  }
}
class ContextStub {
  state = "running";
  sampleRate = 48_000;
  currentTime = 0;
  destination = {};
  sources: SourceStub[] = [];
  media: { audio: AudioStub; gain: GainStub | null }[] = [];
  closed = 0;
  constructor() {
    contexts.push(this);
  }
  createBuffer() {
    return { url: "unlock" };
  }
  createBufferSource() {
    const source = new SourceStub();
    this.sources.push(source);
    return source;
  }
  createGain() {
    return new GainStub(this);
  }
  createMediaElementSource(audio: AudioStub) {
    const source = { audio, gain: null as GainStub | null };
    this.media.push(source);
    return {
      connect(gain: GainStub) {
        source.gain = gain;
      },
    };
  }
  decodeAudioData(bytes: ArrayBuffer) {
    return Promise.resolve({ url: new TextDecoder().decode(bytes) });
  }
  close() {
    this.closed++;
    return Promise.resolve();
  }
}
windowStub.AudioContext = ContextStub;
mock.timers.enable({ apis: ["setInterval"] });
try {
  globalThis.fetch = async (url) => new Response(new TextEncoder().encode(String(url)));
  const live = createAudioPlayer();
  const neighbor = createAudioPlayer();
  live.unlock();
  neighbor.unlock();
  const [ownContext, neighborContext] = contexts;
  assert(ownContext && neighborContext);
  assert.notEqual(ownContext, neighborContext);
  assert.equal(ownContext.sources[0]!.starts, 1, "unlock starts a pulse in the owner's context");
  live.setVolumes({ music: 0.2, sfx: 0.3 });
  live.playMusic("first", assets);
  neighbor.playMusic("second", assets);
  await flushTasks();
  const ownMusic = ownContext.sources[1]!;
  const neighborMusic = neighborContext.sources[1]!;
  assert(ownMusic, "resolved music creates a live decoded Web Audio source");
  assert(ownMusic.buffer?.url.endsWith("first.mp3"));
  assert.equal(ownMusic.starts, 1, "a resolved decode starts the actual Web Audio layer while its owner is live");
  assert.equal(ownMusic.loop, true);
  assert.equal(active("first.mp3").length, 0, "decoded music does not silently fall back to a media element");
  mock.timers.tick(2000);
  assert.equal(ownMusic.gain!.value, 0.2);
  assert.equal(neighborMusic.gain!.value, 0.5);

  live.playSfx("first", assets, 2);
  const effect = active("first.mp3")[0]!;
  assert(effect, "live playSfx starts its pooled media element");
  const effectGain = ownContext.media.find((source) => source.audio === effect)!.gain!;
  assert.equal(effect.volume, 1, "Web Audio gain controls SFX volume rather than the media fallback");
  assert.equal(effectGain.value, 0.3);
  assert.equal(effect.playCount, 1);
  effect.onended!();
  assert.equal(effect.playCount, 2, "loopCount repeats the live SFX");
  effect.onended!();
  assert.equal(effect.onended, null, "SFX stops repeating after the requested count");
  live.setVolumes({ music: 0.4, sfx: 0.1 });
  assert.equal(ownMusic.gain!.value, 0.4);
  assert.equal(effectGain.value, 0.1);
  live.setMuted(true);
  assert.equal(ownMusic.gain!.value, 0);
  assert.equal(effectGain.value, 0);
  assert.equal(neighborMusic.gain!.value, 0.5, "one package's mute and volume leave the neighboring player alone");
  live.setMuted(false);
  assert.equal(ownMusic.gain!.value, 0.4);
  assert.equal(effectGain.value, 0.1);

  live.playMusic("second", assets);
  await flushTasks();
  const crossfadeMusic = ownContext.sources.at(-1)!;
  assert.equal(crossfadeMusic.starts, 1);
  mock.timers.tick(50);
  live.stopMusic();
  assert.equal(crossfadeMusic.stops, 1, "stopMusic cancels the incoming layer during a crossfade");
  mock.timers.tick(2000);
  assert.equal(ownMusic.stops, 1, "stopMusic also fades and releases the outgoing layer");
  assert.equal(ownMusic.disconnected, true);
  assert.equal(ownMusic.gain!.disconnected, true);
  assert.equal(crossfadeMusic.disconnected, true);
  assert.equal(neighborMusic.stops, 0, "stopping one package leaves its neighbor's decoded track running");

  live.playMusic("first", assets);
  await flushTasks();
  mock.timers.tick(2000);
  const immediateMusic = ownContext.sources.at(-1)!;
  live.stopMusic(true);
  assert.equal(immediateMusic.stops, 1, "immediate stop releases a fully playing layer without waiting for a fade");
  live.dispose();
  live.dispose();
  assert.equal(ownContext.closed, 1);
  assert.equal(effect.paused, true, "disposal stops live pooled effects too");
  assert.equal(neighborContext.closed, 0, "disposal closes only the owner's context");
  assert.equal(neighborMusic.stops, 0);
  neighbor.dispose();
  assert.equal(neighborMusic.stops, 1);
  assert.equal(neighborContext.closed, 1);

  let finishFetch!: (response: Response) => void;
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      finishFetch = resolve;
    });
  const beforeFetch = createAudioPlayer();
  beforeFetch.unlock();
  const fetchingContext = contexts.at(-1)!;
  beforeFetch.playMusic("second", assets);
  beforeFetch.dispose();
  finishFetch(new Response(new Uint8Array([0])));
  await flushTasks();
  assert.equal(fetchingContext.sources.length, 1, "fetch completion after disposal cannot create a decoded source");
  assert.equal(fetchingContext.closed, 1);

  globalThis.fetch = async () => new Response(new Uint8Array([0]));
  const beforeDecode = createAudioPlayer();
  beforeDecode.unlock();
  const decodingContext = contexts.at(-1)!;
  let finishDecode!: (buffer: { url: string }) => void;
  decodingContext.decodeAudioData = () =>
    new Promise((resolve) => {
      finishDecode = resolve;
    });
  beforeDecode.playMusic("first", assets);
  await flushTasks();
  assert.equal(typeof finishDecode, "function", "the layer reaches decode while its owner is still live");
  beforeDecode.dispose();
  finishDecode({ url: "late-decode" });
  await flushTasks();
  assert.equal(decodingContext.sources.length, 1, "decode completion after disposal cannot create or start a track");
  assert.equal(decodingContext.closed, 1);
} finally {
  mock.timers.reset();
  globalThis.fetch = originalFetch;
  delete windowStub.AudioContext;
}

audioManager.dispose();
audioManager.playMusic("first", assets);
await tick();
assert.equal(active("first.mp3").length, 1, "Game's existing dispose remains reusable after chat switches");
audioManager.dispose();

const stockTags = [
  "music:dialogue:slice_of_life:calm:town",
  "music:travel_rest:fantasy:calm:inn",
  "music:exploration:fantasy:calm:field",
  "music:combat:fantasy:intense:battle",
  "music:exploration:horror:tense:forest",
];
const manifest = {
  scannedAt: "fixture",
  count: 7,
  byCategory: {},
  assets: Object.fromEntries(
    [...stockTags, "music:area:other-chat:secret", "music:tier:boss:other-chat"].map((tag) => [
      tag,
      { tag, category: "music", subcategory: "", name: tag, path: `${tag}.mp3`, ext: ".mp3" },
    ]),
  ),
};
for (const cue of ["home", "combat", "boss", "happy", "tense", "sad", "bond"] as const) {
  const tag = selectDefaultMusic(cue, manifest);
  assert(tag && stockTags.includes(tag), `${cue} selects an existing stock-state tag`);
  assert.equal(selectDefaultMusic(cue, manifest, { currentTag: tag }), tag, "unchanged cues keep fitting music");
}
assert.equal(selectDefaultMusic("home", { ...manifest, assets: {} }), null);
const explorationOnly = {
  ...manifest,
  assets: Object.fromEntries(Object.entries(manifest.assets).filter(([tag]) => tag.startsWith("music:exploration:"))),
};
for (const cue of ["combat", "boss", "home", "happy", "sad", "bond"] as const) {
  assert.equal(
    selectDefaultMusic(cue, explorationOnly, { currentTag: stockTags[2] }),
    null,
    `${cue} leaves the fallback decision to the caller when its own state has no track`,
  );
}
assert.equal(selectDefaultMusic("tense", explorationOnly), stockTags[4]);
assert.equal(
  selectDefaultMusic("home", {
    ...manifest,
    assets: {
      "music:area:other-chat:secret": manifest.assets["music:area:other-chat:secret"]!,
      "music:tier:boss:other-chat": manifest.assets["music:tier:boss:other-chat"]!,
    },
  }),
  null,
  "another Game's generated context is never a default",
);
console.log("Package audio ownership, gesture lifecycle, permanent disposal and stock selection passed.");
