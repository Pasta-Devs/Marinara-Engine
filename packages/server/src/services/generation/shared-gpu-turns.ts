import { AsyncLocalStorage } from "node:async_hooks";
import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "../llm/base-provider.js";
import { BaseLLMProvider } from "../llm/base-provider.js";
import { resolveGlobalMediaGenerationWaitTimeoutMs } from "../image/image-generation-queue.js";

// Opt-in turn-taking for one GPU shared by a local LLM and a local image/video backend. A swapper
// such as llama-swap unloads one to load the other, so it only sees requests: a media request
// waits while any text request is in flight, and every new text request for the loaded model
// goes straight past it. With a few chats generating, pictures waited for minutes and were lost.
//
// Requests to a host listed in MARINARA_SHARED_GPU_HOSTS take turns on it. Text requests run
// together and media requests run together, never both at once. Once one kind is waiting, new
// requests of the running kind queue behind it, and when the running kind drains, everything
// waiting of the other kind goes at once. Neither kind can starve the other, and the GPU swaps
// once per turn instead of once per request.

export type SharedGpuWork = "text" | "media";

type Waiter = { grant: () => void };
type HostState = { active: SharedGpuWork | null; running: number; waiting: Record<SharedGpuWork, Waiter[]> };

const hostStates = new Map<string, HostState>();
const heldTurns = new AsyncLocalStorage<ReadonlyMap<string, SharedGpuWork>>();

function normalizeHost(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`).host.toLowerCase();
  } catch {
    return "";
  }
}

/** The configured shared GPU host `url` belongs to, or null. Read on every call so .env edits apply. */
export function sharedGpuHostFor(url: string): string | null {
  const configured = (process.env.MARINARA_SHARED_GPU_HOSTS ?? "").split(",").map(normalizeHost).filter(Boolean);
  if (configured.length === 0) return null;
  const host = normalizeHost(url);
  return host && configured.includes(host) ? host : null;
}

const otherWork = (work: SharedGpuWork): SharedGpuWork => (work === "text" ? "media" : "text");

function grantAll(state: HostState, work: SharedGpuWork): void {
  const waiters = state.waiting[work].splice(0);
  if (waiters.length === 0) return;
  state.active = work;
  state.running += waiters.length;
  for (const waiter of waiters) waiter.grant();
}

function pump(host: string, state: HostState): void {
  if (state.running > 0) {
    // The running kind may take latecomers only while the other kind is not waiting.
    if (state.active && state.waiting[otherWork(state.active)].length === 0) grantAll(state, state.active);
    return;
  }
  const order: SharedGpuWork[] = state.active ? [otherWork(state.active), state.active] : ["text", "media"];
  const next = order.find((work) => state.waiting[work].length > 0);
  if (next) {
    grantAll(state, next);
    return;
  }
  hostStates.delete(host);
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("Request aborted while waiting for the shared GPU");
}

async function acquireTurn(host: string, work: SharedGpuWork, signal?: AbortSignal): Promise<() => void> {
  if (signal?.aborted) throw abortError(signal);
  let state = hostStates.get(host);
  if (!state) {
    state = { active: null, running: 0, waiting: { text: [], media: [] } };
    hostStates.set(host, state);
  }
  const current = state;
  if (current.running === 0 && current.waiting.text.length === 0 && current.waiting.media.length === 0) {
    current.active = work;
    current.running = 1;
  } else if (current.active === work && current.running > 0 && current.waiting[otherWork(work)].length === 0) {
    current.running += 1;
  } else {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        const index = current.waiting[work].indexOf(waiter);
        if (index >= 0) current.waiting[work].splice(index, 1);
        // Waiters of the running kind may have queued only because this one was waiting.
        pump(host, current);
        reject(abortError(signal!));
      };
      const waiter: Waiter = {
        grant: () => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        },
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      current.waiting[work].push(waiter);
    });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    current.running -= 1;
    pump(host, current);
  };
}

/**
 * Run `task` in its turn on the shared GPU `url` belongs to; outside a configured host it runs at
 * once. A task already holding a turn on that host runs straight through: waiting for the other
 * kind from inside a turn would wait on itself.
 */
export async function runSharedGpuTurn<T>(
  work: SharedGpuWork,
  url: string,
  task: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const host = sharedGpuHostFor(url);
  const held = heldTurns.getStore();
  if (!host || held?.has(host)) return task();
  // A media request waits for its turn no longer than for a media permit, so a stalled text stream can't hold it, and
  // the text queued behind it, forever. Text keeps waiting for the render it follows.
  const waitMs = work === "media" ? resolveGlobalMediaGenerationWaitTimeoutMs() : Number.POSITIVE_INFINITY;
  // AbortSignal.timeout takes at most 2^32 - 1 ms; a longer limit is as good as none.
  const deadline = waitMs <= 0xffff_ffff ? AbortSignal.timeout(waitMs) : null;
  let release: () => void;
  try {
    release = await acquireTurn(
      host,
      work,
      deadline ? (signal ? AbortSignal.any([signal, deadline]) : deadline) : signal,
    );
  } catch (err) {
    if (deadline?.aborted && !signal?.aborted) {
      // Name what held it: text, or other media work this request couldn't join because text was waiting next.
      const holder =
        hostStates.get(host)?.active === "media" ? "other media work held it" : "text requests kept it busy";
      throw new Error(
        `Waited over ${Math.round(waitMs / 1000)} seconds for the shared GPU (MARINARA_SHARED_GPU_HOSTS) while ${holder}`,
      );
    }
    throw err;
  }
  try {
    return await heldTurns.run(new Map([...(held ?? []), [host, work]]), task);
  } finally {
    release();
  }
}

/** Test-only: hosts with a running or waiting turn. */
export function inspectSharedGpuTurnsForTests(): Record<
  string,
  { active: SharedGpuWork | null; running: number; waiting: number }
> {
  return Object.fromEntries(
    [...hostStates].map(([host, state]) => [
      host,
      { active: state.active, running: state.running, waiting: state.waiting.text.length + state.waiting.media.length },
    ]),
  );
}

class SharedGpuTurnProvider extends BaseLLMProvider {
  constructor(
    readonly provider: BaseLLMProvider,
    private readonly host: string,
  ) {
    super("", "", provider.maxContextValue ?? undefined, null, provider.maxTokensOverrideValue);
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    if (heldTurns.getStore()?.has(this.host)) return yield* this.provider.chat(messages, options);
    const release = await acquireTurn(this.host, "text", options.signal);
    try {
      return yield* this.provider.chat(messages, options);
    } finally {
      release();
    }
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    return runSharedGpuTurn(
      "text",
      `http://${this.host}`,
      () => this.provider.chatComplete(messages, options),
      options.signal,
    );
  }

  // Embeddings pass through: a swapper usually keeps embedding models off the GPU group.
  async embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
    return this.provider.embed(texts, model, signal);
  }
}

/** Text requests to a configured shared GPU host take turns with its media requests. */
export function withSharedGpuTurnProvider(provider: BaseLLMProvider, baseUrl: string): BaseLLMProvider {
  const host = sharedGpuHostFor(baseUrl);
  return host ? new SharedGpuTurnProvider(provider, host) : provider;
}
