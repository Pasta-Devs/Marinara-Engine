import { isPatternSafe } from "../../shared/regex/regex-safety.js";

const DEFAULT_REGEX_TIMEOUT_MS = 50;
const DEFAULT_WORKER_STARTUP_TIMEOUT_MS = 250;
const MAX_REGEX_SCAN_TEXT_LENGTH = 100_000;
const MAX_UNTIMED_FALLBACK_TEXT_LENGTH = 10_000;

const WORKER_SOURCE = `
self.onmessage = (event) => {
  if (event.data?.type === "ready") {
    self.postMessage({ type: "ready" });
    return;
  }
  const { source, flags, text } = event.data;
  try {
    const matched = new RegExp(source, flags).test(text);
    self.postMessage({ type: "result", matched });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
`;

let workerUrl: string | null = null;

function getRegexWorkerUrl(): string | null {
  if (workerUrl) return workerUrl;
  if (typeof URL === "undefined" || typeof Blob === "undefined") return null;
  try {
    workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    return workerUrl;
  } catch {
    return null;
  }
}

function canRunInterruptibleWorker(): boolean {
  return typeof Worker !== "undefined" && getRegexWorkerUrl() !== null;
}

function testWithBoundedUntimedFallback(regex: RegExp, text: string): boolean {
  if (text.length > MAX_UNTIMED_FALLBACK_TEXT_LENGTH) return false;
  const flags = regex.flags.replace(/[gy]/g, "");
  return new RegExp(regex.source, flags).test(text);
}

function testInWorker(regex: RegExp, text: string, timeoutMs: number, startupTimeoutMs: number): Promise<boolean> {
  const url = getRegexWorkerUrl();
  if (!url) return Promise.resolve(testWithBoundedUntimedFallback(regex, text));

  return new Promise((resolve) => {
    let worker: Worker;
    let executionTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    let ready = false;
    try {
      worker = new Worker(url);
    } catch {
      resolve(testWithBoundedUntimedFallback(regex, text));
      return;
    }

    const finish = (matched: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimer);
      if (executionTimer) clearTimeout(executionTimer);
      worker.terminate();
      resolve(matched);
    };

    const fallbackAndFinish = () => {
      finish(testWithBoundedUntimedFallback(regex, text));
    };

    const startRegexTest = () => {
      if (ready) return;
      ready = true;
      executionTimer = setTimeout(() => {
        finish(false);
      }, timeoutMs);

      const flags = regex.flags.replace(/[gy]/g, "");
      try {
        worker.postMessage({ type: "test", source: regex.source, flags, text });
      } catch {
        fallbackAndFinish();
      }
    };

    const startupTimer = setTimeout(() => {
      fallbackAndFinish();
    }, startupTimeoutMs);

    worker.onmessage = (
      event: MessageEvent<
        { type: "ready" } | { type: "result"; matched: boolean } | { type: "error"; message: string }
      >,
    ) => {
      if (event.data.type === "ready") {
        clearTimeout(startupTimer);
        startRegexTest();
        return;
      }

      finish(event.data.type === "result" ? Boolean(event.data.matched) : false);
    };

    worker.onerror = () => {
      fallbackAndFinish();
    };

    try {
      worker.postMessage({ type: "ready" });
    } catch {
      fallbackAndFinish();
    }
  });
}

/**
 * Browser-safe lorebook regex executor.
 *
 * The legacy Node server used `vm.runInContext` with a hard timeout. Refactor
 * runs in browser/Tauri contexts, so user regexes execute inside a disposable
 * Worker. Worker startup gets a small separate budget so first-use load time
 * does not count as regex execution time. Once the worker is ready, the regex
 * deadline applies to the actual match. If the worker does not answer before
 * that deadline, it is terminated and the match fails closed.
 *
 * If the runtime cannot create a Worker, safe regex scans use a much smaller
 * bounded fallback so worker capability loss does not silently turn every regex
 * activation into a non-match. Oversized fallback scans still fail closed.
 */
function createTimeoutRegexExecutor(
  timeoutMs: number = DEFAULT_REGEX_TIMEOUT_MS,
  startupTimeoutMs: number = DEFAULT_WORKER_STARTUP_TIMEOUT_MS,
) {
  return async function vmRegexExecutor(regex: RegExp, text: string): Promise<boolean> {
    if (text.length > MAX_REGEX_SCAN_TEXT_LENGTH || !isPatternSafe(regex.source)) {
      return false;
    }
    if (!canRunInterruptibleWorker()) {
      return testWithBoundedUntimedFallback(regex, text);
    }
    return testInWorker(regex, text, timeoutMs, startupTimeoutMs);
  };
}

export const vmRegexExecutor = createTimeoutRegexExecutor();
