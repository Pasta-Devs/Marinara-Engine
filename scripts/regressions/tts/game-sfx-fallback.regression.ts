// When a Game sound effect's file won't play, the built-in synthesized sound plays instead, as many times as the
// effect still had to repeat. Disposing Game audio cancels fallbacks that haven't played yet and detaches the effect
// players, so a sound from a closed game never plays later.
import assert from "node:assert/strict";
import { mock } from "node:test";

const elements: AudioStub[] = [];
const failPending: Array<() => void> = [];
class AudioStub {
  preload = "";
  muted = false;
  volume = 1;
  loop = false;
  src = "";
  currentTime = 0;
  paused = true;
  onerror: (() => void) | null = null;
  onended: (() => void) | null = null;
  constructor(src = "") {
    this.src = src;
    elements.push(this);
  }
  play() {
    // A "pending" file is still loading until the test fails it; every other file fails to play at once, as a
    // missing or blocked file does.
    if (this.src.includes("pending")) {
      return new Promise<void>((_resolve, reject) => {
        failPending.push(() => reject(new DOMException("No supported source", "NotSupportedError")));
      });
    }
    return Promise.reject(new DOMException("No supported source", "NotSupportedError"));
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
let oscillators = 0;
const audioParam = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
const audioNode = () => ({
  connect() {},
  disconnect() {},
  start() {},
  stop() {},
  context: { currentTime: 0 },
  gain: audioParam(),
  frequency: audioParam(),
});
class AudioContextStub {
  state = "running";
  currentTime = 0;
  destination = {};
  sampleRate = 44_100;
  resume() {
    return Promise.resolve();
  }
  createOscillator() {
    oscillators += 1;
    return { ...audioNode(), type: "sine" };
  }
  createGain() {
    return audioNode();
  }
  createBiquadFilter() {
    return { ...audioNode(), type: "highpass", Q: audioParam() };
  }
  createBufferSource() {
    return { ...audioNode(), buffer: null };
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createMediaElementSource() {
    return audioNode();
  }
}
Object.assign(globalThis, {
  Audio: AudioStub,
  window: { AudioContext: AudioContextStub },
  document: { addEventListener() {}, removeEventListener() {} },
});
mock.timers.enable({ apis: ["setTimeout"] });
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const { audioManager } = await import("../../../packages/client/src/lib/game-audio.js");
const assets = { "ui:click": { path: "sfx/click.mp3" }, "ui:menu-hover": { path: "sfx/pending.mp3" } };

audioManager.unlock();
// The click fallback is two tones, so three remaining plays make six.
audioManager.playSfx("ui:click", assets, 3);
await flush();
mock.timers.tick(2_000);
assert.equal(oscillators, 6, "Procedural SFX fallback must preserve the bounded number of remaining sequential plays");

oscillators = 0;
audioManager.playSfx("ui:click", assets, 3);
audioManager.playSfx("ui:menu-hover", assets, 2);
await flush();
assert.ok(
  elements.some((element) => element.onended !== null),
  "the still-loading effect has its handlers attached before the dispose",
);
audioManager.dispose();
mock.timers.tick(2_000);
assert.equal(oscillators, 0, "Disposing Game audio must cancel fallbacks that haven't played yet");
const sfxPlayers = elements.filter((element) => element.onerror !== null || element.onended !== null);
assert.deepEqual(sfxPlayers, [], "Disposing Game audio must detach the effect players' handlers");
// The still-loading effect fails only now, after the dispose: its fallback belongs to the closed game.
for (const fail of failPending.splice(0)) fail();
await flush();
mock.timers.tick(2_000);
assert.equal(oscillators, 0, "a play that fails after a dispose must not fall back to a sound");

// Game's audio is reused after a dispose: a new effect still falls back.
audioManager.unlock();
audioManager.playSfx("ui:click", assets, 1);
await flush();
mock.timers.tick(2_000);
assert.equal(oscillators, 2);
mock.timers.reset();
