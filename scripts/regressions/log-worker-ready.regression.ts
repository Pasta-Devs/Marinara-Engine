import assert from "node:assert/strict";
import { once, type EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { Worker } from "node:worker_threads";

// Outside production the server logs through pino-pretty in a thread-stream worker, which keeps the
// process alive until its READY handshake sees the read index reach a write index snapshotted earlier.
// thread-stream 4.2.0 compared with ===, so a read that jumped past the snapshot, or an index reset
// under it, never completed the handshake and the process could not exit (#6529). pnpm-workspace.yaml
// patches in the upstream fix. This drives the copy pino loads through thread-stream's own worker hook.
type ThreadStream = EventEmitter & { write(data: string): boolean; worker: Worker };
const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const pinoRequire = createRequire(serverRequire.resolve("pino"));
const ThreadStream = pinoRequire("thread-stream") as new (options: object) => ThreadStream;
const worker = fileURLToPath(new URL("./fixtures/thread-stream-ready-worker.cjs", import.meta.url));
Object.assign(globalThis, { __bundlerPathsOverrides: { "thread-stream-worker": worker } });

async function becomesReady(firstWrite: string, onStartupWrite: (stream: ThreadStream) => void) {
  const stream = new ThreadStream({
    filename: worker,
    sync: true,
    bufferSize: 4,
    workerData: { indexes: pinoRequire.resolve("thread-stream/lib/indexes.js") },
  });
  stream.on("error", () => undefined);
  stream.on("startup-write", () => onStartupWrite(stream));
  // Written before the worker starts, so the READY handshake snapshots it.
  stream.write(firstWrite);
  let timer: NodeJS.Timeout | undefined;
  const ready = await Promise.race([
    once(stream, "ready").then(() => true),
    new Promise<boolean>((resolve) => (timer = setTimeout(resolve, 5_000, false))),
  ]);
  clearTimeout(timer);
  const closed = once(stream, "close");
  stream.worker.postMessage({ code: "SHUTDOWN" });
  await closed;
  return ready;
}

assert.ok(
  await becomesReady("a", (stream) => {
    stream.write("b");
    stream.worker.postMessage({ code: "ADVANCE" });
  }),
  "A read index that jumps past the READY snapshot must still complete the handshake",
);

assert.ok(
  await becomesReady("aa", (stream) => {
    stream.worker.postMessage({ code: "READ_ALONG" });
    // Overfills the 4-byte buffer, so writeSync runs flushSync and resetIndexes twice under the handshake.
    stream.write("bbbbbbb");
  }),
  "Index resets under the READY snapshot must still complete the handshake",
);

console.info("Log worker ready regression passed");
