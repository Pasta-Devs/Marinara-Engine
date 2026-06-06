import type { LlmChunk, LlmCompletion, LlmGateway, LlmRequest } from "../../engine/capabilities/llm";
import { Channel } from "@tauri-apps/api/core";
import { ApiError } from "./api-errors";
import { ignoreLlmStreamCancelFailure } from "./llm-cancel-logging";
import { invokeTauri } from "./tauri-client";
import { cancelRemoteLlmStream, remoteRuntimeTarget, streamRemoteLlm, type RuntimeTarget } from "./remote-runtime";

function createStreamId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `llm-stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const activeTauriStreamIds = new Set<string>();
const activeRemoteStreams = new Map<string, RuntimeTarget>();
let unloadCancellationInstalled = false;
const TAURI_STREAM_TERMINAL_CLEANUP_GRACE_MS = 250;

function wait(ms: number): Promise<false> {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => resolve(false), ms);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readContent(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeLlmCompletion(value: unknown): LlmCompletion {
  if (typeof value === "string") return { content: value };
  if (!isRecord(value)) return { content: "" };
  return {
    content: readContent(value.content),
    toolCalls: Array.isArray(value.toolCalls)
      ? value.toolCalls
      : Array.isArray(value.tool_calls)
        ? value.tool_calls
        : [],
    finishReason: readString(value.finishReason ?? value.finish_reason) || null,
    usage: value.usage ?? null,
    providerMetadata: value.providerMetadata ?? value.provider_metadata ?? null,
  };
}

async function completeRich(request: LlmRequest): Promise<LlmCompletion> {
  return normalizeLlmCompletion(
    await invokeTauri("llm_complete", {
      request,
    }),
  );
}

function chunkText(event: LlmChunk): string | undefined {
  if (typeof event.text === "string") return event.text;
  if (typeof event.data === "string") return event.data;
  const record = event as LlmChunk & { error?: unknown; message?: unknown };
  const data = isRecord(event.data) ? event.data : {};
  return (
    readString(record.message) ||
    readString(record.error) ||
    readString(data.message) ||
    readString(data.error) ||
    undefined
  );
}

function streamErrorChunk(error: unknown): LlmChunk {
  let message = "LLM stream failed";
  let status: number | undefined;
  let details: Record<string, unknown> = {};

  if (error instanceof ApiError) {
    message = error.message || message;
    status = error.status;
    details = isRecord(error.details)
      ? { ...error.details }
      : error.details !== undefined
        ? { details: error.details }
        : {};
  } else if (error instanceof Error) {
    message = error.message || message;
  } else if (isRecord(error)) {
    message = readString(error.message) || readString(error.error) || message;
    details = isRecord(error.data)
      ? { ...error.data }
      : isRecord(error.details)
        ? { ...error.details }
        : error.details !== undefined
          ? { details: error.details }
          : {};
    const code = readString(error.code);
    const nextStatus = readNumber(error.status) ?? readNumber(error.statusCode);
    if (code && details.code === undefined) details.code = code;
    if (nextStatus !== null) status = nextStatus;
  } else {
    message = String(error ?? message) || message;
  }

  return {
    type: "error",
    text: message,
    data: {
      ...details,
      message,
      ...(status !== undefined ? { status } : {}),
    },
  };
}

function cancelActiveTauriStreams() {
  for (const streamId of activeTauriStreamIds) {
    void ignoreLlmStreamCancelFailure("tauri", streamId, invokeTauri("llm_stream_cancel", { streamId }));
  }
}

function cancelActiveRemoteStreams() {
  for (const [streamId, target] of activeRemoteStreams) {
    void cancelRemoteLlmStream(streamId, target, { keepalive: true });
  }
}

function cancelActiveLlmStreams() {
  cancelActiveTauriStreams();
  cancelActiveRemoteStreams();
}

function installUnloadCancellation() {
  if (unloadCancellationInstalled || typeof window === "undefined") return;
  unloadCancellationInstalled = true;
  window.addEventListener("pagehide", cancelActiveLlmStreams);
  window.addEventListener("beforeunload", cancelActiveLlmStreams);
}

export const llmApi: LlmGateway = {
  complete: async (request: LlmRequest) => (await completeRich(request)).content,
  completeRich,
  embed: async (request) => {
    const body = {
      input: request.texts,
      connectionId: request.connectionId ?? null,
      model: request.model ?? null,
    };
    const response = await invokeTauri<{ data?: Array<{ embedding?: unknown }> }>("llm_embed", {
      body,
    });
    const vectors = response.data?.map((item) =>
      Array.isArray(item.embedding)
        ? item.embedding.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        : [],
    );
    return vectors?.every((vector) => vector.length > 0) ? vectors : null;
  },
  stream: async function* (request: LlmRequest, signal?: AbortSignal): AsyncGenerator<LlmChunk> {
    const streamId = createStreamId();
    const remoteTarget = remoteRuntimeTarget();
    if (remoteTarget) {
      installUnloadCancellation();
      activeRemoteStreams.set(streamId, remoteTarget);
      const abort = () => void cancelRemoteLlmStream(streamId, remoteTarget);
      if (signal?.aborted) abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        for await (const event of streamRemoteLlm(streamId, request, remoteTarget, signal)) {
          if (event.type === "done") continue;
          yield event;
          if (event.type === "error") return;
        }
      } finally {
        signal?.removeEventListener("abort", abort);
        activeRemoteStreams.delete(streamId);
      }
      return;
    }
    installUnloadCancellation();
    activeTauriStreamIds.add(streamId);
    const queue: LlmChunk[] = [];
    let completed = false;
    let failure: unknown = null;
    let wake: (() => void) | null = null;
    let commandSettled = false;
    let cancelRequested = false;
    let terminalEventReceived = false;

    const notify = () => {
      wake?.();
      wake = null;
    };
    const cancelNativeStream = () => {
      if (cancelRequested || commandSettled) return;
      cancelRequested = true;
      void ignoreLlmStreamCancelFailure("tauri", streamId, invokeTauri("llm_stream_cancel", { streamId }));
    };
    const abort = () => {
      failure = new DOMException("The operation was aborted.", "AbortError");
      cancelNativeStream();
      notify();
    };

    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });

    const onEvent = new Channel<LlmChunk>((event) => {
      const text = chunkText(event);
      const normalized = text === undefined ? event : { ...event, text };
      if (normalized.type === "done" || normalized.type === "error") {
        terminalEventReceived = true;
        completed = true;
      }
      queue.push(normalized);
      notify();
    });

    const command = invokeTauri<void>("llm_stream_channel", {
      streamId,
      request,
      onEvent,
    }).then(
      () => {
        commandSettled = true;
      },
      (error) => {
        commandSettled = true;
        if (cancelRequested || isAbortError(error)) {
          failure ??= error;
        } else {
          queue.push(streamErrorChunk(error));
        }
        completed = true;
        notify();
      },
    );

    try {
      while (!completed || queue.length > 0) {
        if (failure) throw failure;
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
          continue;
        }
        const event = queue.shift()!;
        if (event.type === "done") continue;
        yield event;
      }
      if (commandSettled) {
        await command;
      } else if (terminalEventReceived) {
        // command handles native success and rejection, so this race only distinguishes settled cleanup from timeout.
        const cleanedUp = await Promise.race([command.then(() => true), wait(TAURI_STREAM_TERMINAL_CLEANUP_GRACE_MS)]);
        if (!cleanedUp) cancelNativeStream();
      } else {
        cancelNativeStream();
      }
      if (failure) throw failure;
    } finally {
      signal?.removeEventListener("abort", abort);
      cancelNativeStream();
      activeTauriStreamIds.delete(streamId);
    }
  },
  listModels: (connectionId?: string | null) =>
    invokeTauri("llm_list_models", {
      connectionId: connectionId ?? null,
    }),
};
