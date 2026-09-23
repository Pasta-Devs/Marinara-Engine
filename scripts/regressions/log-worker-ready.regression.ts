import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Outside production the server logs through pino-pretty in a thread-stream worker, which keeps the
// process alive until its READY handshake sees the read index reach a write index snapshotted earlier.
// thread-stream 4.2.0 compared with ===, so a read that jumped past the snapshot, or an index reset
// under it, never completed the handshake and the process could not exit (#6529). pnpm-workspace.yaml
// patches in the upstream fix; this pins the behavior through the copy pino actually loads.
type Wait = (
  state: Int32Array,
  index: number,
  expected: number,
  timeout: number,
  done: (error: Error | null, result: string) => void,
) => void;
const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const pinoRequire = createRequire(serverRequire.resolve("pino"));
const { wait } = pinoRequire("thread-stream/lib/wait.js") as { wait: Wait };

function waitFor(state: Int32Array, expected: number, timeoutMs: number) {
  return new Promise<string>((resolve, reject) => {
    // A pending Atomics.waitAsync does not hold the event loop open, so this timer does.
    const guard = setTimeout(() => resolve("no result"), timeoutMs + 1_000);
    wait(state, 0, expected, timeoutMs, (error, result) => {
      clearTimeout(guard);
      if (error) reject(error);
      else resolve(result);
    });
  });
}

const overshot = new Int32Array(new SharedArrayBuffer(4));
Atomics.store(overshot, 0, 700);
assert.equal(await waitFor(overshot, 350, 500), "ok", "A read index past the snapshot must complete the handshake");

const reset = new Int32Array(new SharedArrayBuffer(4));
Atomics.store(reset, 0, 350);
const pending = waitFor(reset, 900, 2_000);
setTimeout(() => {
  Atomics.store(reset, 0, 0);
  Atomics.notify(reset, 0);
}, 20);
assert.equal(await pending, "not-equal", "An index reset must hand control back so the handshake can snapshot again");

console.info("Log worker ready regression passed");
