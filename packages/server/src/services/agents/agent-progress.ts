import { randomUUID } from "node:crypto";
import type { AgentContext, AgentTaskProgress } from "@marinara-engine/shared";
import type { BaseLLMProvider, ChatMessage, ChatOptions } from "../llm/base-provider.js";
import { logger } from "../../lib/logger.js";

/** Observe an existing call without changing its provider, streaming policy, or debug setting. */
export async function completeAgentCall(
  context: AgentContext,
  agents: AgentTaskProgress["agents"],
  provider: BaseLLMProvider,
  messages: ChatMessage[],
  options: ChatOptions,
) {
  if (!context.agentProgress) return provider.chatComplete(messages, options);
  const startedAt = Date.now();
  const progress: AgentTaskProgress = {
    callId: randomUUID(),
    agents: agents.map(({ id, type, name, phase }) => ({ id, type, name, phase })),
    stage: "waiting",
    receivedChunks: 0,
    receivedCharacters: 0,
    elapsedMs: 0,
  };
  let lastEmission = startedAt;
  const emit = () => {
    lastEmission = Date.now();
    progress.elapsedMs = lastEmission - startedAt;
    try {
      context.agentProgress?.({ ...progress });
    } catch (error) {
      logger.warn(error, "Could not send agent progress");
    }
  };
  const receive = (chunk: string) => {
    if (!chunk) return;
    progress.receivedChunks++;
    progress.receivedCharacters += chunk.length;
    progress.stage = "streaming";
    const first = progress.ttftMs === undefined;
    if (first) progress.ttftMs = Date.now() - startedAt;
    // One first-chunk update, then at most four updates/second per call.
    if (first || Date.now() - lastEmission >= 250) emit();
  };
  emit();
  try {
    const result = await provider.chatComplete(messages, {
      ...options,
      ...(options.stream !== false
        ? {
            onToken: async (chunk: string) => {
              receive(chunk);
              await options.onToken?.(chunk);
            },
            onThinking: (chunk: string) => {
              receive(chunk);
              options.onThinking?.(chunk);
            },
          }
        : {}),
    });
    progress.stage =
      result.finishReason === "abort" ? "stopped" : result.finishReason === "error" ? "error" : "received";
    if (result.usage) {
      progress.promptTokens = result.usage.promptTokens;
      progress.completionTokens = result.usage.completionTokens;
    }
    emit();
    return result;
  } catch (error) {
    progress.stage = options.signal?.aborted ? "stopped" : "error";
    emit();
    throw error;
  }
}
