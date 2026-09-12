// #5889: Safari TTS freeze. playWhenAvailable retried a NotAllowedError with
// zero backoff whenever the tab was visible and focused - which is exactly
// when Safari's autoplay policy throws it - spinning the main thread with a
// promise + DOMException per iteration until WebKit killed the tab. The fix
// parks blocked playback behind a real user gesture (whose transient
// activation is what makes the retry succeed), caps total attempts, and
// floors the hidden-tab retry path. These tests drive the REAL exported
// function with stubbed globals and count play() calls - the bug's signature
// is a call count that keeps climbing, so a bounded count IS the assertion.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { playWhenAvailable } from "../../packages/client/src/lib/tts-service.js";
import {
  __readTTSAudioFromMemoryForTests,
  __rememberTTSAudioInMemoryForTests,
  __resetTTSMemoryCacheForTests,
  __ttsMemoryCacheStatsForTests,
} from "../../packages/client/src/lib/tts-audio-cache.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Listener = (event?: unknown) => void;
const gestureListeners = new Map<string, Set<Listener>>();
const windowStub = {
  addEventListener(name: string, fn: Listener) {
    if (!gestureListeners.has(name)) gestureListeners.set(name, new Set());
    gestureListeners.get(name)?.add(fn);
  },
  removeEventListener(name: string, fn: Listener) {
    gestureListeners.get(name)?.delete(fn);
  },
};
const documentStub: {
  visibilityState: string;
  hasFocus: () => boolean;
  addEventListener: () => void;
  removeEventListener: () => void;
} = {
  visibilityState: "visible",
  hasFocus: () => true,
  addEventListener() {},
  removeEventListener() {},
};
function dispatchGesture() {
  for (const fn of [...(gestureListeners.get("pointerdown") ?? [])]) fn();
}
function notAllowed(): Error {
  const err = new Error("play() blocked by autoplay policy");
  err.name = "NotAllowedError";
  return err;
}

(globalThis as Record<string, unknown>).window = windowStub;
(globalThis as Record<string, unknown>).document = documentStub;
try {
  // ── Blocked playback waits for a gesture instead of spinning ──────────────
  {
    let plays = 0;
    let blocked = 0;
    const audio = {
      play() {
        plays += 1;
        return plays < 3 ? Promise.reject(notAllowed()) : Promise.resolve();
      },
    };
    const done = playWhenAvailable(audio, undefined, () => {
      blocked += 1;
    });
    // The old code would rack up thousands of play() calls in this window.
    await sleep(300);
    assert.equal(plays, 1, "a blocked visible tab must NOT retry until a gesture arrives");
    assert.equal(blocked, 1, "the blocked callback fires so the UI can say 'tap to play'");
    dispatchGesture();
    await sleep(50);
    assert.equal(plays, 2, "a gesture earns exactly one retry");
    dispatchGesture();
    await done;
    assert.equal(plays, 3, "the retry inside the gesture's activation succeeds");
    assert.equal(blocked, 2);
  }

  // ── The attempt cap ends a hopeless loop with the real error ──────────────
  {
    let plays = 0;
    const audio = {
      play() {
        plays += 1;
        return Promise.reject(notAllowed());
      },
    };
    const rejection = playWhenAvailable(audio, undefined, () => {
      // Auto-tap after the gesture listeners attach (they attach right after
      // this callback returns, synchronously before the awaited promise).
      setTimeout(dispatchGesture, 1);
    }).then(
      () => null,
      (err: unknown) => err,
    );
    const err = (await rejection) as Error | null;
    assert.ok(err instanceof Error, "an unplayable sequence must reject, not hang");
    assert.equal(err.name, "NotAllowedError", "the original policy error surfaces to the caller");
    assert.equal(plays, 20, "the cap bounds total attempts");
  }

  // ── Non-policy errors are never retried ───────────────────────────────────
  {
    let plays = 0;
    let blocked = 0;
    const failure = new Error("decode failed");
    failure.name = "NotSupportedError";
    const audio = {
      play() {
        plays += 1;
        return Promise.reject(failure);
      },
    };
    const err = await playWhenAvailable(audio, undefined, () => {
      blocked += 1;
    }).then(
      () => null,
      (e: unknown) => e,
    );
    assert.equal(err, failure);
    assert.equal(plays, 1);
    assert.equal(blocked, 0);
  }
  // A decode failure whose tab goes hidden mid-play fails immediately too -
  // it does not heal by foregrounding, so it must not park until the cap.
  // (A tab hidden at ENTRY never plays at all - that gate is by design.)
  {
    let plays = 0;
    const failure = new Error("decode failed");
    failure.name = "NotSupportedError";
    const audio = {
      play() {
        plays += 1;
        documentStub.visibilityState = "hidden";
        return Promise.reject(failure);
      },
    };
    const err = await playWhenAvailable(audio).then(
      () => null,
      (e: unknown) => e,
    );
    assert.equal(err, failure, "a non-policy error surfaces even when the tab just went hidden");
    assert.equal(plays, 1);
    documentStub.visibilityState = "visible";
  }
} finally {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).document;
}

// ── Memory cache: byte cap protects iOS, where memory is the only tier ──────
{
  __resetTTSMemoryCacheForTests();
  const mb = (n: number) => new Blob([new Uint8Array(n * 1024 * 1024)]);
  __rememberTTSAudioInMemoryForTests("a", mb(30));
  __rememberTTSAudioInMemoryForTests("b", mb(30));
  __rememberTTSAudioInMemoryForTests("c", mb(30));
  let stats = __ttsMemoryCacheStatsForTests();
  assert.equal(stats.entries, 2, "the oldest blob is evicted when the byte cap is crossed");
  assert.equal(stats.bytes, 60 * 1024 * 1024);
  __rememberTTSAudioInMemoryForTests("huge", mb(65));
  stats = __ttsMemoryCacheStatsForTests();
  assert.equal(stats.entries, 2, "a single over-budget blob never enters the cache");
  // True LRU, not FIFO: reading through the production path refreshes
  // recency, so the untouched entry is the one the byte cap evicts.
  __resetTTSMemoryCacheForTests();
  const blobA = mb(30);
  __rememberTTSAudioInMemoryForTests("lru-a", blobA);
  __rememberTTSAudioInMemoryForTests("lru-b", mb(30));
  assert.equal(__readTTSAudioFromMemoryForTests("lru-a"), blobA, "the read path returns the cached blob");
  __rememberTTSAudioInMemoryForTests("lru-c", mb(30));
  assert.equal(__readTTSAudioFromMemoryForTests("lru-a"), blobA, "recently read audio survives the eviction");
  assert.equal(__readTTSAudioFromMemoryForTests("lru-b"), null, "the least-recently-USED entry is the one evicted");

  // Alias keys share one physical Blob - the budget must count it once.
  __resetTTSMemoryCacheForTests();
  const shared = mb(30);
  __rememberTTSAudioInMemoryForTests("primary", shared);
  __rememberTTSAudioInMemoryForTests("alias-1", shared);
  __rememberTTSAudioInMemoryForTests("alias-2", shared);
  stats = __ttsMemoryCacheStatsForTests();
  assert.equal(stats.entries, 3);
  assert.equal(stats.bytes, 30 * 1024 * 1024, "one blob under three keys books its size exactly once");
  __rememberTTSAudioInMemoryForTests("other", mb(30));
  stats = __ttsMemoryCacheStatsForTests();
  assert.equal(stats.entries, 4, "aliases must not eat the budget of distinct audio");
  __rememberTTSAudioInMemoryForTests("alias-1", mb(1));
  stats = __ttsMemoryCacheStatsForTests();
  assert.equal(stats.bytes, 61 * 1024 * 1024, "re-keying an alias to new audio keeps the shared blob booked once");
  __resetTTSMemoryCacheForTests();
  for (let i = 0; i < 151; i += 1) __rememberTTSAudioInMemoryForTests(`k${i}`, new Blob([new Uint8Array(8)]));
  stats = __ttsMemoryCacheStatsForTests();
  assert.equal(stats.entries, 150, "the entry cap still applies");
  assert.equal(stats.bytes, 150 * 8, "the byte counter tracks evictions exactly");
  __resetTTSMemoryCacheForTests();
}

// ── Source pins: the wiring that turns "blocked" into a user affordance ─────
const service = readSource("packages/client/src/lib/tts-service.ts");
assert.match(service, /"idle" \| "loading" \| "playing" \| "paused" \| "blocked" \| "error"/u);
// Each playback path is asserted in its own method slice - an aggregate
// count could be satisfied by one path double-handling while another is bare.
{
  const methodSlice = (start: string, end: string) => {
    const from = service.indexOf(start);
    const to = service.indexOf(end);
    assert.ok(from >= 0 && to > from, `method anchors present: ${start} .. ${end}`);
    return service.slice(from, to);
  };
  assert.match(
    methodSlice("async speak(", "async speakSequence("),
    /this\.setState\("blocked", id \?\? null\)/u,
    "speak surfaces the blocked state",
  );
  assert.match(
    methodSlice("async speakSequence(", "resume(): void"),
    /this\.setState\("blocked", request\.activeId \?\? id \?\? null\)/u,
    "speakSequence surfaces the blocked state",
  );
  assert.match(
    methodSlice("resume(): void", "restart(): void"),
    /this\.setState\("blocked"\)/u,
    "resume surfaces the blocked state",
  );
  assert.match(
    methodSlice("restart(): void", "private cleanup(): void"),
    /this\.setState\("blocked"\)/u,
    "restart surfaces the blocked state",
  );
}
assert.match(service, /const MAX_PLAY_ATTEMPTS = 20;/u);
assert.match(service, /await waitForUserGesture\(signal\);/u);
const chatArea = readSource("packages/client/src/components/chat/ChatArea.tsx");
assert.match(
  chatArea,
  /state === "blocked" && lastTtsState !== "blocked"/u,
  "ChatArea tells the user the one tap that resumes blocked audio",
);
assert.match(chatArea, /ui\.chat\.chatarea\.audioBlockedTapToPlay/u);
const enJson = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;
assert.ok("ui.chat.chatarea.audioBlockedTapToPlay" in enJson);
const chatMessage = readSource("packages/client/src/components/chat/ChatMessage.tsx");
assert.match(chatMessage, /ttsState === "paused" \|\| ttsState === "blocked"/u);

// This lane needs DOM lib types, so it is type-checked by its own tsconfig
// chained into the CLIENT lint - pin both ends so it cannot silently unhook.
assert.match(readSource("scripts/regressions/tsconfig.client-lanes.json"), /tts-safari-play-guard\.regression\.ts/u);
assert.match(
  readSource("packages/client/package.json"),
  /tsc -p \.\.\/\.\.\/scripts\/regressions\/tsconfig\.client-lanes\.json/u,
  "client lint runs the client-lane type check",
);

// A decode error while parked must release the gesture listeners by aborting
// the controller - a nulled-but-live controller would let a later keystroke
// retry a dead element on a revoked object URL.
assert.match(
  service,
  /fail\(new Error\("Audio playback failed"\)\);\s*\/\/ Then release the parked gesture listeners\.\s*abortController\.abort\(\);/u,
  "the sequence onerror settles the chunk with the real failure BEFORE the abort can swallow it",
);
assert.match(
  service,
  /this\.setState\("error"\);[^]{0,400}?abortController\.abort\(\);\s*\};/u,
  "the single-clip onerror records the decode failure before releasing the park",
);
assert.match(chatArea, /toast\.dismiss\("tts-playback-blocked"\)/u, "resuming playback clears the tap-to-play toast");
const configCard = readSource("packages/client/src/components/panels/settings/TTSConfigCard.tsx");
assert.match(configCard, /ttsState === "playing" \|\| ttsState === "loading" \|\| ttsState === "blocked"/u);
// Fresh-checkout CI runs client lint before anything builds shared dist, so
// the lane tsconfig must resolve @marinara-engine/shared from SOURCE.
assert.match(
  readSource("scripts/regressions/tsconfig.client-lanes.json"),
  /packages\/shared\/src\/index\.ts/u,
  "the client-lane tsconfig maps shared to its source, not dist",
);

console.log("TTS Safari play-guard regressions passed.");
