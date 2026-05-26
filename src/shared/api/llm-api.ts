import type { LlmChunk, LlmGateway, LlmRequest } from "../../engine/capabilities/llm";
import { Channel } from "@tauri-apps/api/core";
import { ignoreLlmStreamCancelFailure } from "./llm-cancel-logging";
import { invokeTauri } from "./tauri-client";
import { cancelRemoteLlmStream, remoteRuntimeTarget, streamRemoteLlm } from "./remote-runtime";

function createStreamId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `llm-stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const llmApi: LlmGateway = {
  complete: (request: LlmRequest) =>
    invokeTauri("llm_complete", {
      request,
    }),
  stream: async function* (request: LlmRequest, signal?: AbortSignal): AsyncGenerator<LlmChunk> {
    const streamId = createStreamId();
    const remoteTarget = remoteRuntimeTarget();
    if (remoteTarget) {
      const abort = () => void cancelRemoteLlmStream(streamId, remoteTarget);
      if (signal?.aborted) abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        yield* streamRemoteLlm(streamId, request, remoteTarget, signal);
      } finally {
        signal?.removeEventListener("abort", abort);
      }
      return;
    }
    const queue: LlmChunk[] = [];
    let completed = false;
    let failure: unknown = null;
    let wake: (() => void) | null = null;

    const notify = () => {
      wake?.();
      wake = null;
    };
    const abort = () => {
      failure = new DOMException("The operation was aborted.", "AbortError");
      void ignoreLlmStreamCancelFailure("tauri", streamId, invokeTauri("llm_stream_cancel", { streamId }));
      notify();
    };

    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });

    const onEvent = new Channel<LlmChunk>((event) => {
      const text = typeof event.text === "string" ? event.text : typeof event.data === "string" ? event.data : undefined;
      const normalized = text === undefined ? event : { ...event, text };
      if (normalized.type === "done" || normalized.type === "error") completed = true;
      queue.push(normalized);
      notify();
    });

    const command = invokeTauri<void>("llm_stream_channel", {
      streamId,
      request,
      onEvent,
    }).catch((error) => {
      failure = error;
      completed = true;
      notify();
    });

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
        if (event.type === "error") throw new Error(String(event.text ?? event.data ?? "LLM stream failed"));
        yield event;
      }
      await command;
      if (failure) throw failure;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  },
  listModels: (connectionId?: string | null) =>
    invokeTauri("llm_list_models", {
      connectionId: connectionId ?? null,
    }),
};
