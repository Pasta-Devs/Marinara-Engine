import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalWorker = globalThis.Worker;

async function importExecutor() {
  vi.resetModules();
  return import("./regex-timeout");
}

function installCreateObjectUrl() {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:regex-worker"),
  });
}

function installWorker(worker: unknown) {
  vi.stubGlobal("Worker", worker);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (createObjectUrlDescriptor) {
    Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
  } else {
    delete (URL as { createObjectURL?: unknown }).createObjectURL;
  }
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    writable: true,
    value: originalWorker,
  });
});

beforeEach(() => {
  installCreateObjectUrl();
});

describe("vmRegexExecutor", () => {
  it("resolves safe regex matches through a worker", async () => {
    class MatchingWorker {
      onmessage:
        | ((event: MessageEvent<{ type: "ready" } | { type: "result"; matched: boolean }>) => void)
        | null = null;

      constructor(readonly url: string) {}

      terminate() {}

      postMessage(message: { type: "ready" } | { type: "test"; source: string; flags: string; text: string }) {
        if (message.type === "ready") {
          queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } } as MessageEvent));
          return;
        }
        const matched = new RegExp(message.source, message.flags).test(message.text);
        queueMicrotask(() => this.onmessage?.({ data: { type: "result", matched } } as MessageEvent));
      }
    }

    installWorker(MatchingWorker);
    const { vmRegexExecutor } = await importExecutor();

    await expect(vmRegexExecutor(/hello/i, "well hello there")).resolves.toBe(true);
  });

  it("does not count worker startup time against the regex execution deadline", async () => {
    vi.useFakeTimers();

    class SlowStartupWorker {
      onmessage:
        | ((event: MessageEvent<{ type: "ready" } | { type: "result"; matched: boolean }>) => void)
        | null = null;

      constructor(readonly url: string) {}

      terminate() {}

      postMessage(message: { type: "ready" } | { type: "test"; source: string; flags: string; text: string }) {
        if (message.type === "ready") {
          setTimeout(() => this.onmessage?.({ data: { type: "ready" } } as MessageEvent), 75);
          return;
        }
        const matched = new RegExp(message.source, message.flags).test(message.text);
        queueMicrotask(() => this.onmessage?.({ data: { type: "result", matched } } as MessageEvent));
      }
    }

    installWorker(SlowStartupWorker);
    const { vmRegexExecutor } = await importExecutor();

    const result = vmRegexExecutor(/hello/i, "well hello there");
    await vi.advanceTimersByTimeAsync(75);

    await expect(result).resolves.toBe(true);
  });

  it("falls back when the worker never becomes ready", async () => {
    vi.useFakeTimers();

    class NeverReadyWorker {
      static last: NeverReadyWorker | null = null;
      terminated = false;

      constructor(readonly url: string) {
        NeverReadyWorker.last = this;
      }

      terminate() {
        this.terminated = true;
      }

      postMessage() {}
    }

    installWorker(NeverReadyWorker);
    const { vmRegexExecutor } = await importExecutor();

    const result = vmRegexExecutor(/hello/i, "well hello there");
    await vi.advanceTimersByTimeAsync(250);

    await expect(result).resolves.toBe(true);
    expect(NeverReadyWorker.last?.terminated).toBe(true);
  });

  it("fails closed when the worker times out", async () => {
    vi.useFakeTimers();

    class SilentWorker {
      static last: SilentWorker | null = null;
      onmessage: ((event: MessageEvent<{ type: "ready" }>) => void) | null = null;
      terminated = false;

      constructor(readonly url: string) {
        SilentWorker.last = this;
      }

      terminate() {
        this.terminated = true;
      }

      postMessage(message: { type: "ready" } | { type: "test" }) {
        if (message.type === "ready") {
          queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } } as MessageEvent));
        }
      }
    }

    installWorker(SilentWorker);
    const { vmRegexExecutor } = await importExecutor();

    const result = vmRegexExecutor(/hello/i, "hello");
    await vi.advanceTimersByTimeAsync(51);

    await expect(result).resolves.toBe(false);
    expect(SilentWorker.last?.terminated).toBe(true);
  });

  it("contains worker construction failures inside the bounded fallback", async () => {
    class ThrowingWorker {
      constructor(readonly url: string) {
        throw new Error(`cannot construct ${url}`);
      }
    }

    installWorker(ThrowingWorker);
    const { vmRegexExecutor } = await importExecutor();

    await expect(vmRegexExecutor(/hello/i, "well hello there")).resolves.toBe(true);
    await expect(vmRegexExecutor(/hello/i, `${"x".repeat(10_001)}hello`)).resolves.toBe(false);
  });

  it("uses the bounded fallback when workers are unavailable", async () => {
    installWorker(undefined);
    const { vmRegexExecutor } = await importExecutor();

    await expect(vmRegexExecutor(/hello/i, "well hello there")).resolves.toBe(true);
    await expect(vmRegexExecutor(/hello/i, `${"x".repeat(10_001)}hello`)).resolves.toBe(false);
  });
});
