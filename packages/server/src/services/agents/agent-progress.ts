import { randomUUID } from "node:crypto";
import type { AgentContext, AgentTaskProgress } from "@marinara-engine/shared";
import { extractLeadingThinkingBlocks } from "@marinara-engine/shared";
import {
  measureContextBudget,
  type BaseLLMProvider,
  type ChatMessage,
  type ChatOptions,
} from "../llm/base-provider.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { tryParseJsonRecord } from "../../lib/json-repair.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { normalizeGemma4Delimiters } from "../llm/textual-tool-call-parser.js";
import { minContextLimit, normalizeMaxContext } from "../generation/generation-parameters.js";

/** Observe an existing call while forwarding its explicit agent debug setting. */
export async function completeAgentCall(
  context: Pick<AgentContext, "agentDebug" | "sceneCheck" | "agentProgress" | "signal">,
  agents: AgentTaskProgress["agents"],
  provider: BaseLLMProvider,
  messages: ChatMessage[],
  options: ChatOptions,
) {
  if (context.agentDebug && options.debugMode !== true) options = { ...options, debugMode: true };
  let sceneCheck =
    context.sceneCheck &&
    !context.sceneCheck.claimed &&
    context.sceneCheck.prompt.trim() &&
    !options.tools?.length &&
    !options.signal?.aborted &&
    !context.signal?.aborted &&
    agents.some((agent) => agent.phase === "post_processing" && context.sceneCheck!.trackerAgentIds.includes(agent.id))
      ? context.sceneCheck
      : undefined;
  if (sceneCheck) {
    const combinedMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        contextKind: "prompt",
        content: `${sceneCheck.prompt}\n\nKeep the requested tracker JSON unchanged and add one reserved top-level field: "__scene_check": {"ends": [{"messageNumber": 42}]}. Use an empty ends array when no scene clearly ends. For a batch, put this field beside the agent ID fields, not inside a tracker result.`,
      },
    ];
    const maxContext = minContextLimit(
      normalizeMaxContext(options.maxContext),
      normalizeMaxContext(provider.maxContextValue),
    );
    const maxTokens = Math.min(
      normalizeMaxContext(options.maxTokens) ?? 4096,
      normalizeMaxContext(provider.maxTokensOverrideValue) ?? Infinity,
    );
    if (maxContext && measureContextBudget(combinedMessages, { ...options, maxContext, maxTokens }).fits) {
      sceneCheck.claimed = true;
      messages = combinedMessages;
    } else {
      logger.debug(
        "[scene-check] Keeping tracker request unchanged: %s",
        maxContext ? "scene window exceeds the context budget" : "tracker context cap is unknown",
      );
      sceneCheck = undefined;
    }
  }
  if (sceneCheck) {
    logDebugOverride(
      Boolean(context.agentDebug) || options.debugMode === true || isDebugAgentsEnabled(),
      "[agent-debug] Tracker request with scene check:\n%s",
      messages.map((message) => `[${message.role}] ${message.content}`).join("\n\n"),
    );
    try {
      context.agentDebug?.({
        stage: "request",
        agentId: agents.length === 1 ? agents[0]!.id : "__batch__",
        agentType: agents.length === 1 ? agents[0]!.type : "__batch__",
        agentName: agents.map((agent) => agent.name).join(", "),
        phase: agents.length === 1 ? agents[0]!.phase : "batch",
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens ?? 0,
        messageCount: messages.length,
        messages: messages.map(({ role, content }) => ({ role, content })),
        ...(agents.length > 1 ? { batchedAgentTypes: agents.map((agent) => agent.type) } : {}),
      });
    } catch (error) {
      logger.warn(error, "Could not send scene-check tracker prompt diagnostics");
    }
  }
  if (!context.agentProgress && !sceneCheck) return provider.chatComplete(messages, options);
  const startedAt = Date.now();
  const progress: AgentTaskProgress = {
    callId: randomUUID(),
    agents: [
      ...agents.map(({ id, type, name, phase }) => ({ id, type, name, phase })),
      ...(sceneCheck
        ? [
            {
              id: "advanced-recall",
              type: "advanced-recall",
              name: "Advanced Recall",
              phase: "post_processing" as const,
            },
          ]
        : []),
    ],
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
    let streamedText = "";
    const result = await provider.chatComplete(messages, {
      ...options,
      ...(options.stream !== false
        ? {
            onToken: async (chunk: string) => {
              receive(chunk);
              if (sceneCheck) streamedText += chunk;
              else await options.onToken?.(chunk);
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
    if (sceneCheck) {
      let content = streamedText || result.content;
      let jsonContent = extractLeadingThinkingBlocks(content ?? "").content;
      if (jsonContent.includes('<|"|>')) jsonContent = normalizeGemma4Delimiters(jsonContent);
      let parsed = jsonContent ? tryParseJsonRecord(jsonContent) : null;
      // The ordinary tracker parser also accepts a short prose prefix before its JSON object.
      const objectStart = jsonContent.indexOf("{");
      if (!parsed && objectStart > 0) parsed = tryParseJsonRecord(jsonContent.slice(objectStart));
      if (parsed && Object.hasOwn(parsed, "__scene_check")) {
        const payload = parsed.__scene_check;
        delete parsed.__scene_check;
        content = JSON.stringify(parsed);
        if (
          !options.signal?.aborted &&
          !context.signal?.aborted &&
          result.finishReason === "stop" &&
          !result.toolCalls.length &&
          payload &&
          typeof payload === "object" &&
          Array.isArray((payload as Record<string, unknown>).ends) &&
          ((payload as Record<string, unknown>).ends as unknown[]).every(
            (end) =>
              end &&
              typeof end === "object" &&
              Number.isInteger((end as Record<string, unknown>).messageNumber) &&
              Number((end as Record<string, unknown>).messageNumber) > 0,
          )
        ) {
          sceneCheck.result = payload;
        }
      }
      // Keep provider/progress streaming live; the tracker parser receives only its own JSON.
      if (options.stream !== false && content) await options.onToken?.(content);
      return { ...result, content };
    }
    return result;
  } catch (error) {
    progress.stage = options.signal?.aborted ? "stopped" : "error";
    emit();
    throw error;
  }
}
