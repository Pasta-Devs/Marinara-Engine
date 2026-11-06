import assert from "node:assert/strict";
import { AsyncResource } from "node:async_hooks";
import { EventEmitter, getEventListeners } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "marinara-grok-idle-"));
process.env.DATA_DIR = directory;
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.LOG_LEVEL = "silent";
const { GrokSubscriptionProvider, fetchGrokCliModels } =
  await import("../../packages/server/src/services/llm/providers/grok-subscription.provider.js");
const { withLlmRequestTimeout } = await import("../../packages/server/src/services/llm/base-provider.js");
const childProcess = createRequire(import.meta.url)("node:child_process") as typeof import("node:child_process");
const originalSpawn = childProcess.spawn;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
let clock = 0;
const timers = new Set<{ at: number; callback: () => void; refresh(): unknown; unref(): unknown }>();
// Native Timeout.refresh() behavior; Node24 mock.timers does not move its deadline.
globalThis.setTimeout = ((callback: () => void, ms: number) => {
  const timer = {
    at: clock + ms,
    callback,
    refresh() {
      this.at = clock + ms;
      timers.add(this);
      return this;
    },
    unref() {
      return this;
    },
  };
  timers.add(timer);
  return timer;
}) as unknown as typeof setTimeout;
globalThis.clearTimeout = ((timer: Parameters<typeof timers.delete>[0]) =>
  timers.delete(timer)) as unknown as typeof clearTimeout;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const advance = async (ms: number) => {
  const end = clock + ms;
  for (;;) {
    const next = [...timers].filter((timer) => timer.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!next) break;
    clock = next.at;
    timers.delete(next);
    next.callback();
    await flush();
  }
  clock = end;
  await flush();
};

class Child extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kills: string[] = [];
  data = AsyncResource.bind((pipe: "stdout" | "stderr", value: string) => this[pipe].emit("data", Buffer.from(value)));
  constructor(readonly args: string[]) {
    super();
  }
  kill(signal: string) {
    this.kills.push(signal);
    return true;
  }
  close(code = 0) {
    this.emit("close", code, null);
  }
  get promptFile() {
    return this.args[this.args.indexOf("--prompt-file") + 1];
  }
}
const spawned = new Set<Child>();
const scratchDirectories = new Set<string>();
let nextSpawn = Promise.withResolvers<Child>();
childProcess.spawn = ((_command: string, args: string[], options: { cwd: string }) => {
  assert.equal(_command, "grok", "the regression must never launch a real provider");
  const child = new Child(args);
  spawned.add(child);
  scratchDirectories.add(options.cwd);
  nextSpawn.resolve(child);
  return child;
}) as unknown as typeof childProcess.spawn;
syncBuiltinESMExports();
const provider = new GrokSubscriptionProvider("", "");
async function generation(signal?: AbortSignal) {
  nextSpawn = Promise.withResolvers<Child>();
  let activity = 0;
  const result = withLlmRequestTimeout(
    600_000,
    () =>
      provider.chatComplete([{ role: "user", content: "Fixture" }], {
        model: "grok-composer-2.5-fast",
        stream: true,
        signal,
      }),
    () => {
      activity++;
    },
  );
  const child = await nextSpawn.promise;
  await flush();
  return { child, result, activity: () => activity };
}
async function cleaned(child: Child) {
  await flush();
  assert.equal(timers.size, 0, "completed commands release request and kill timers");
  if (child.args.includes("--prompt-file"))
    assert.equal(existsSync(child.promptFile), false, "generation removes its prompt file");
}

try {
  {
    const call = await generation();
    await advance(540_000);
    call.child.data("stdout", "Hello");
    await advance(540_000);
    call.child.data("stderr", "Thinking");
    await advance(540_000);
    call.child.data("stdout", " world");
    assert.deepEqual(call.child.kills, [], "actual stdout/stderr keeps generation alive beyond ten minutes total");
    assert.equal(call.activity(), 3, "both output streams still reach the shared activity scope");
    call.child.close();
    const result = await call.result;
    assert.equal(result.content, "Hello world");
    assert.equal(result.finishReason, "stop");
    await cleaned(call.child);
  }
  {
    const call = await generation();
    const rejected = assert.rejects(call.result, /request timed out after 600s without output\./);
    await advance(540_000);
    call.child.data("stdout", "partial reply");
    await advance(599_999);
    call.child.data("stdout", "");
    call.child.data("stderr", "");
    assert.deepEqual(call.child.kills, []);
    await advance(1);
    assert.deepEqual(call.child.kills, ["SIGTERM"], "empty chunks do not renew the silence budget");
    call.child.data("stderr", "late output after timeout");
    assert.equal(timers.size, 1, "late data cannot restart a timed-out request timer");
    await advance(1_999);
    assert.deepEqual(call.child.kills, ["SIGTERM"]);
    await advance(1);
    assert.deepEqual(call.child.kills, ["SIGTERM", "SIGKILL"]);
    call.child.close(1);
    await rejected;
    await cleaned(call.child);
  }
  {
    const controller = new AbortController();
    const call = await generation(controller.signal);
    const rejected = assert.rejects(call.result, /request was aborted/);
    controller.abort();
    assert.deepEqual(call.child.kills, ["SIGTERM"]);
    call.child.data("stdout", "ignored late content");
    await advance(2_000);
    assert.deepEqual(call.child.kills, ["SIGTERM", "SIGKILL"], "user stop retains finite process escalation");
    call.child.close(1);
    await rejected;
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    await cleaned(call.child);
  }
  {
    nextSpawn = Promise.withResolvers<Child>();
    const result = fetchGrokCliModels();
    const rejected = assert.rejects(result, /models lookup timed out after 30s\./);
    const child = await nextSpawn.promise;
    assert.deepEqual(child.args, ["models"]);
    await advance(29_999);
    child.data("stdout", "grok-composer-2.5-fast");
    child.data("stderr", "lookup heartbeat");
    await advance(1);
    assert.deepEqual(child.kills, ["SIGTERM"], "model discovery retains its total thirty-second budget");
    await advance(2_000);
    assert.deepEqual(child.kills, ["SIGTERM", "SIGKILL"]);
    child.close(1);
    await rejected;
    await cleaned(child);
  }
  console.info(
    "Grok CLI inactivity: active generation, finite silence, user stop, cleanup and bounded model discovery passed.",
  );
} finally {
  childProcess.spawn = originalSpawn;
  syncBuiltinESMExports();
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  for (const child of spawned) child.close(1);
  for (const scratch of scratchDirectories) await rm(scratch, { recursive: true, force: true });
  await rm(directory, { recursive: true, force: true });
}
