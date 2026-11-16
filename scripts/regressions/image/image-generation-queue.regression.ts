// The image generation queue: queued requests on one connection run one at a time, in order; unqueued ones run
// together; a failed request doesn't block the next one, and an aborted one never runs.
import assert from "node:assert/strict";
import { runImageGenerationRequest } from "../../../packages/server/src/services/image/image-generation-queue.js";

const nextEventLoopTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
const queuedImageEvents: string[] = [];
let releaseFirstQueuedImage: () => void = () => undefined;
const firstQueuedImageGate = new Promise<void>((resolve) => {
  releaseFirstQueuedImage = resolve;
});
const firstQueuedImage = runImageGenerationRequest({
  connectionKey: "regression-queued-connection",
  queue: true,
  task: async () => {
    queuedImageEvents.push("first:start");
    await firstQueuedImageGate;
    queuedImageEvents.push("first:end");
    return "first";
  },
});
const secondQueuedImage = runImageGenerationRequest({
  connectionKey: "regression-queued-connection",
  queue: true,
  task: async () => {
    queuedImageEvents.push("second:start");
    return "second";
  },
});
await nextEventLoopTurn();
assert.deepEqual(queuedImageEvents, ["first:start"]);
releaseFirstQueuedImage();
assert.deepEqual(await Promise.all([firstQueuedImage, secondQueuedImage]), ["first", "second"]);
assert.deepEqual(queuedImageEvents, ["first:start", "first:end", "second:start"]);
let activeUnqueuedImages = 0;
let maxActiveUnqueuedImages = 0;
let releaseUnqueuedImages: () => void = () => undefined;
const unqueuedImageGate = new Promise<void>((resolve) => {
  releaseUnqueuedImages = resolve;
});
const runUnqueuedImage = () =>
  runImageGenerationRequest({
    connectionKey: "regression-unqueued-connection",
    queue: false,
    task: async () => {
      activeUnqueuedImages += 1;
      maxActiveUnqueuedImages = Math.max(maxActiveUnqueuedImages, activeUnqueuedImages);
      await unqueuedImageGate;
      activeUnqueuedImages -= 1;
    },
  });
const unqueuedImages = [runUnqueuedImage(), runUnqueuedImage()];
await nextEventLoopTurn();
assert.equal(maxActiveUnqueuedImages, 2);
releaseUnqueuedImages();
await Promise.all(unqueuedImages);
const failedQueuedImage = runImageGenerationRequest({
  connectionKey: "regression-failed-connection",
  queue: true,
  task: async () => {
    throw new Error("expected queued image failure");
  },
});
const recoveredQueuedImage = runImageGenerationRequest({
  connectionKey: "regression-failed-connection",
  queue: true,
  task: async () => "recovered",
});
await assert.rejects(failedQueuedImage, /expected queued image failure/u);
assert.equal(await recoveredQueuedImage, "recovered");
let releaseBlockingQueuedImage: () => void = () => undefined;
const blockingQueuedImageGate = new Promise<void>((resolve) => {
  releaseBlockingQueuedImage = resolve;
});
const blockingQueuedImage = runImageGenerationRequest({
  connectionKey: "regression-aborted-connection",
  queue: true,
  task: async () => blockingQueuedImageGate,
});
const queuedAbortController = new AbortController();
const abortedQueuedImage = runImageGenerationRequest({
  connectionKey: "regression-aborted-connection",
  queue: true,
  signal: queuedAbortController.signal,
  task: async () => "should-not-run",
});
queuedAbortController.abort(new Error("expected queued abort"));
await assert.rejects(abortedQueuedImage, /expected queued abort/u);
releaseBlockingQueuedImage();
await blockingQueuedImage;
