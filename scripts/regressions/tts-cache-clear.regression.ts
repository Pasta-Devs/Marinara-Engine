import assert from "node:assert/strict";
import {
  deleteCachedTTSAudioKeys,
  getCachedTTSAudioBlob,
  getOrCreateCachedTTSAudioBlob,
} from "../../packages/client/src/lib/tts-audio-cache.js";

const first = new Blob(["first voice"]);
const other = new Blob(["another message"]);
await getOrCreateCachedTTSAudioBlob("first", async () => first, ["first-text"]);
await getOrCreateCachedTTSAudioBlob("other", async () => other);
await getOrCreateCachedTTSAudioBlob("shared-other", async () => other, ["first-text"]);
await deleteCachedTTSAudioKeys(["first", "first-text"]);
assert.equal(await getCachedTTSAudioBlob("first"), null);
assert.equal(await getCachedTTSAudioBlob("first-text"), null);
assert.equal(await getCachedTTSAudioBlob("other"), other);
assert.equal(await getCachedTTSAudioBlob("shared-other"), first, "Another message keeps its own cached clip");

let started!: () => void;
let finish!: (blob: Blob) => void;
const ready = new Promise<void>((resolve) => (started = resolve));
const pending = getOrCreateCachedTTSAudioBlob(
  "pending",
  () => {
    started();
    return new Promise<Blob>((resolve) => (finish = resolve));
  },
  ["pending-text"],
);
await ready;
const joined = getOrCreateCachedTTSAudioBlob("pending", async () => {
  assert.fail("Concurrent callers should share synthesis");
});
await new Promise((resolve) => setTimeout(resolve, 0));
let finishUnrelated!: (blob: Blob) => void;
let unrelatedStarted!: () => void;
const unrelatedReady = new Promise<void>((resolve) => (unrelatedStarted = resolve));
const unrelated = getOrCreateCachedTTSAudioBlob("unrelated-pending", () => {
  unrelatedStarted();
  return new Promise<Blob>((resolve) => (finishUnrelated = resolve));
});
await unrelatedReady;
await deleteCachedTTSAudioKeys(["pending", "pending-text"]);
finish(first);
finishUnrelated(other);
await Promise.all([pending, joined, unrelated]);
assert.equal(
  await getCachedTTSAudioBlob("unrelated-pending"),
  other,
  "Clearing one clip preserves unrelated synthesis",
);
assert.equal(await getCachedTTSAudioBlob("pending"), null, "Late callers must not restore cleared audio");
assert.equal(await getCachedTTSAudioBlob("pending-text"), null);
assert.equal(await getOrCreateCachedTTSAudioBlob("pending", async () => other), other);
assert.equal(await getCachedTTSAudioBlob("pending"), other);

// Purging while the initial cache lookup is awaiting must also prevent late registration.
let earlyStarted!: () => void;
let finishEarly!: (blob: Blob) => void;
const earlyReady = new Promise<void>((resolve) => (earlyStarted = resolve));
const early = getOrCreateCachedTTSAudioBlob(
  "early",
  () => {
    earlyStarted();
    return new Promise<Blob>((resolve) => (finishEarly = resolve));
  },
  ["early-text"],
);
await deleteCachedTTSAudioKeys(["early", "early-text"]);
await earlyReady;
const afterPurge = getOrCreateCachedTTSAudioBlob("early", async () => other, ["early-text"]);
await new Promise((resolve) => setTimeout(resolve, 0));
finishEarly(first);
await early;
assert.equal(await afterPurge, other, "A post-purge caller must not join work registered after it was cleared");
assert.equal(await getCachedTTSAudioBlob("early"), other);
