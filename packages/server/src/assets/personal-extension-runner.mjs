import vm from "node:vm";
import { appendFile, open, writeFile } from "node:fs/promises";

const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const MAX_PROTOCOL_FILE_BYTES = 64 * 1024 * 1024;
const STARTUP_TIMEOUT_MS = 10_000;
const CLEANUP_TIMEOUT_MS = 2_000;
// #4706: adaptive polling — hot only while traffic is flowing, idle cadence
// otherwise, and heartbeats at 5s instead of a flash write every second.
// These values MUST stay in sync with services/extensions/sandbox-protocol.ts
// (the runner is a standalone sandbox asset and cannot import server modules);
// scripts/regressions/extension-ipc.regression.ts pins the pairing.
const HOT_POLL_MS = 25;
const IDLE_POLL_MS = 250;
const HOT_WINDOW_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 5_000;
const [inputPath, outputPath, heartbeatPath] = process.argv.slice(2);
if (!inputPath || !outputPath || !heartbeatPath) process.exit(64);
const callbacks = new Set();
const pendingStorage = new Map();
let requestCounter = 0;
let extension = null;
let stopping = false;
let heartbeat = null;
let writeQueue = Promise.resolve();
let inputOffset = 0;
let inputBuffer = Buffer.alloc(0);
let readingInput = false;
let lastActivityAt = Date.now();
let inputTimer = null;
let inputChainStopped = false;

function send(message) {
  const serialized = JSON.stringify(message);
  if (Buffer.byteLength(serialized, "utf8") > MAX_MESSAGE_BYTES) return;
  writeQueue = writeQueue.then(() => appendFile(outputPath, `${serialized}\n`, "utf8"));
  // Runner->host traffic predicts a reply (storage-result) on the input file;
  // flip the adaptive input poll back to the hot cadence (#4706).
  lastActivityAt = Date.now();
  scheduleInputPoll(HOT_POLL_MS);
  return writeQueue;
}

function safeArgs(args) {
  return args.map((value) => {
    try {
      const serialized = JSON.stringify(value);
      return serialized === undefined ? String(value) : JSON.parse(serialized);
    } catch {
      return String(value);
    }
  });
}

function storageRequest(action, payload) {
  const requestId = `${++requestCounter}`;
  return new Promise((resolve, reject) => {
    pendingStorage.set(requestId, { resolve, reject });
    send({ type: "storage", requestId, action, payload });
  });
}

function managedTimeout(fn, ms) {
  const timer = setTimeout(() => {
    callbacks.delete(timer);
    try {
      fn();
    } catch (error) {
      send({ type: "runtime-error", message: error instanceof Error ? error.message : String(error) });
    }
  }, Math.max(0, Math.min(2 ** 31 - 1, Number(ms) || 0)));
  callbacks.add(timer);
  return timer;
}

function managedInterval(fn, ms) {
  const timer = setInterval(() => {
    try {
      fn();
    } catch (error) {
      send({ type: "runtime-error", message: error instanceof Error ? error.message : String(error) });
    }
  }, Math.max(1, Math.min(2 ** 31 - 1, Number(ms) || 1)));
  callbacks.add(timer);
  return timer;
}

function clearManagedTimer(timer) {
  callbacks.delete(timer);
  clearTimeout(timer);
  clearInterval(timer);
}

async function stop() {
  if (stopping) return;
  stopping = true;
  if (heartbeat) clearInterval(heartbeat);
  for (const callback of callbacks) clearManagedTimer(callback);
  callbacks.clear();
  const cleanupFns = extension?.cleanupFns ?? [];
  for (const cleanup of [...cleanupFns].reverse()) {
    try {
      await Promise.race([
        Promise.resolve(cleanup()),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Cleanup timed out")), CLEANUP_TIMEOUT_MS)),
      ]);
    } catch (error) {
      send({ type: "log", level: "warn", args: [`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`] });
    }
  }
  inputChainStopped = true;
  if (inputTimer) clearTimeout(inputTimer);
  await send({ type: "stopped" });
  await writeQueue;
  await inputHandle.close();
  process.exit(0);
}

async function start(message) {
  if (extension) throw new Error("Extension runner is already initialized");
  const cleanupFns = [];
  extension = { cleanupFns };
  const log = (level, args) => send({ type: "log", level, args: safeArgs(args) });
  const marinara = Object.freeze({
    runtime: "server",
    version: 2,
    // The host supplies its shared estimator; compile it in an isolated realm,
    // never expose a host function or module loader to extension code.
    ...(typeof message.tokenEstimatorSource === "string"
      ? {
          estimateTextTokens: new vm.Script(message.tokenEstimatorSource).runInNewContext(Object.create(null), {
            timeout: 1_000,
            contextCodeGeneration: { strings: false, wasm: false },
          }),
        }
      : {}),
    extensionId: message.id,
    extensionName: message.name,
    log: Object.freeze({
      debug: (...args) => log("debug", args),
      info: (...args) => log("info", args),
      warn: (...args) => log("warn", args),
      error: (...args) => log("error", args),
    }),
    storage: Object.freeze({
      get: () => storageRequest("get"),
      patch: (patch) => storageRequest("patch", patch),
      delete: () => storageRequest("delete"),
    }),
    setTimeout: managedTimeout,
    setInterval: managedInterval,
    clearTimeout: clearManagedTimer,
    clearInterval: clearManagedTimer,
    onCleanup: (fn) => {
      if (typeof fn !== "function") throw new Error("onCleanup requires a function");
      cleanupFns.push(fn);
    },
  });
  const safeConsole = Object.freeze({
    debug: (...args) => log("debug", args),
    info: (...args) => log("info", args),
    warn: (...args) => log("warn", args),
    error: (...args) => log("error", args),
    log: (...args) => log("info", args),
  });
  const context = vm.createContext(
    {
      marinara,
      console: safeConsole,
      setTimeout: managedTimeout,
      setInterval: managedInterval,
      clearTimeout: clearManagedTimer,
      clearInterval: clearManagedTimer,
    },
    {
      name: `marinara-extension-${message.id}`,
      codeGeneration: { strings: false, wasm: false },
    },
  );
  const script = new vm.Script(`(async () => {\n"use strict";\n${message.source}\n})()`, {
    filename: `marinara-extension-${message.id}.js`,
  });
  const result = script.runInContext(context, { timeout: 1_000 });
  await Promise.race([
    Promise.resolve(result),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Extension startup timed out")), STARTUP_TIMEOUT_MS)),
  ]);
  send({ type: "ready" });
}

const handleMessage = (line) => {
  if (Buffer.byteLength(line, "utf8") > MAX_MESSAGE_BYTES) {
    send({ type: "fatal", message: "Extension message exceeded the size limit" });
    void stop();
    return;
  }
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    send({ type: "fatal", message: "Invalid extension protocol message" });
    void stop();
    return;
  }
  if (message.type === "start") {
    void start(message).catch((error) => {
      send({ type: "fatal", message: error instanceof Error ? error.message : String(error) });
      void stop();
    });
    return;
  }
  if (message.type === "storage-result") {
    const pending = pendingStorage.get(message.requestId);
    if (!pending) return;
    pendingStorage.delete(message.requestId);
    if (message.ok) pending.resolve(message.value);
    else pending.reject(new Error(message.error || "Storage request failed"));
    return;
  }
  if (message.type === "stop") void stop();
};

const inputHandle = await open(inputPath, "r");
const pollInput = async () => {
  if (readingInput) return;
  readingInput = true;
  try {
    const stats = await inputHandle.stat();
    if (stats.size > MAX_PROTOCOL_FILE_BYTES) {
      send({ type: "fatal", message: "Extension input protocol exceeded its lifetime quota" });
      void stop();
      return;
    }
    const available = stats.size - inputOffset;
    if (available <= 0) return;
    const chunk = Buffer.alloc(available);
    const { bytesRead } = await inputHandle.read(chunk, 0, available, inputOffset);
    inputOffset += bytesRead;
    if (bytesRead > 0) lastActivityAt = Date.now();
    inputBuffer = Buffer.concat([inputBuffer, chunk.subarray(0, bytesRead)]);
    while (inputBuffer.includes(0x0a)) {
      const newline = inputBuffer.indexOf(0x0a);
      const line = inputBuffer.subarray(0, newline).toString("utf8");
      inputBuffer = inputBuffer.subarray(newline + 1);
      if (line) handleMessage(line);
    }
    // Cap the residual (incomplete message) too — the same per-message
    // semantic the host applies. A newline-less message must not grow the
    // buffer unbounded between polls.
    if (inputBuffer.byteLength > MAX_MESSAGE_BYTES) {
      send({ type: "fatal", message: "Extension message exceeded the size limit" });
      void stop();
      return;
    }
  } catch (error) {
    send({ type: "fatal", message: error instanceof Error ? error.message : String(error) });
    void stop();
  } finally {
    readingInput = false;
  }
};
// #4706: self-scheduling chain — 25ms while the start handshake is pending or
// traffic moved within the hot window, 250ms at idle. The handle is
// REASSIGNED every tick; the heartbeat interval anchors process liveness.
function scheduleInputPoll(delayMs) {
  if (inputChainStopped) return;
  if (inputTimer) clearTimeout(inputTimer);
  const delay =
    delayMs ?? (!extension || Date.now() - lastActivityAt <= HOT_WINDOW_MS ? HOT_POLL_MS : IDLE_POLL_MS);
  inputTimer = setTimeout(() => {
    void pollInput().finally(() => scheduleInputPoll());
  }, delay);
}
void pollInput().finally(() => scheduleInputPoll());
heartbeat = setInterval(() => {
  void writeFile(heartbeatPath, String(Date.now()), "utf8");
}, HEARTBEAT_INTERVAL_MS);

process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
process.on("uncaughtException", (error) => {
  send({ type: "fatal", message: error.message });
  void stop();
});
process.on("unhandledRejection", (error) => {
  send({ type: "fatal", message: error instanceof Error ? error.message : String(error) });
  void stop();
});
