"use strict";
// Stands in for thread-stream's worker so log-worker-ready.regression.ts can script the READY race (#6529).
const { parentPort, workerData } = require("node:worker_threads");
const { READ_INDEX, WRITE_INDEX } = require(workerData.workerData.indexes);

const state = new Int32Array(workerData.stateBuf);
function readTo(index) {
  Atomics.store(state, READ_INDEX, index);
  Atomics.notify(state, READ_INDEX);
}

parentPort.on("message", (message) => {
  if (message?.code === "ADVANCE") {
    readTo(Atomics.load(state, WRITE_INDEX));
  } else if (message?.code === "READ_ALONG") {
    // Read on this thread's own timer, because the main thread blocks in flushSync until it does.
    setInterval(() => {
      const written = Atomics.load(state, WRITE_INDEX);
      if (Atomics.load(state, READ_INDEX) !== written) readTo(written);
    }, 1);
  } else if (message?.code === "SHUTDOWN") {
    process.exit(0);
  }
});

parentPort.postMessage({ code: "READY" });
parentPort.postMessage({ code: "EVENT", name: "startup-write" });
