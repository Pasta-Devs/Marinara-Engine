import type { ChatMessage, LLMToolDefinition } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import type { createConnectionsStorage } from "../storage/connections.storage.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "./generation-parameters.js";
import { fitMessagesForModelAccess, resolveModelAccessPolicy } from "./model-access-policy.js";

type ToolConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

/** A separate request, never a provider swap inside the narrator's tool history. */
export async function planGameToolCalls(args: {
  connection: ToolConnection;
  baseUrl: string;
  messages: ChatMessage[];
  tools: LLMToolDefinition[];
  forceToolCall: boolean;
  signal: AbortSignal;
  debugMode: boolean;
  debugLog: (message: string, ...args: unknown[]) => void;
}) {
  const conn = args.connection;
  const provider = createLLMProvider(
    conn.provider,
    args.baseUrl,
    conn.apiKey,
    conn.maxContext,
    conn.openrouterProvider,
    conn.maxTokensOverride,
    conn.claudeFastMode === "true",
    conn.treatAsLocalEndpoint === "true",
    conn.defaultParameters,
  );
  const policy = resolveModelAccessPolicy(conn);
  // ponytail: one planning round cannot chain lookups; use Same as narrator for
  // multi-round tool reasoning. Keep this opt-in pass independent and bounded.
  const fit = fitMessagesForModelAccess({
    messages: [
      ...args.messages.map(({ role, content }): ChatMessage => ({ role: role === "tool" ? "user" : role, content })),
      {
        // Anthropic and Google hoist system messages; keep this request-local
        // instruction in the final conversation turn on every provider.
        role: "user",
        content:
          "You are planning tools for the Game narrator, not writing narration. For the latest player action, call only the available tools whose real results are needed now. Do not invent results or repeat completed actions. If no tool is needed, return no tool calls. A separate narrator will receive the actual results and write the scene. You have one planning request; independent tools may be called together.",
      },
    ],
    policy,
    maxTokens: Math.min(conn.maxTokensOverride ?? Infinity, resolveStoredMaxTokens(conn.defaultParameters, 2048)),
    tools: args.tools,
  });
  args.debugLog("[game/tools] Planning prompt sent to %s (%s): %j", conn.name, conn.model, fit.messages);
  const storedOptions = resolveStoredChatOptions(conn.defaultParameters, conn.provider, conn.model);
  return provider.chatComplete(fit.messages, {
    model: conn.model,
    ...storedOptions,
    enableThinking: !!storedOptions.reasoningEffort && storedOptions.reasoningEffort !== "none",
    maxTokens: fit.maxTokensForSend,
    maxContext: policy.effectiveMaxContext,
    suppressModelParameters: policy.suppressModelParameters,
    tools: args.tools,
    toolChoice: args.forceToolCall ? "required" : "auto",
    enableCaching: conn.enableCaching === "true",
    anthropicExtendedCacheTtl: conn.anthropicExtendedCacheTtl === "true",
    cachingAtDepth: conn.cachingAtDepth ?? 5,
    debugMode: args.debugMode,
    signal: args.signal,
  });
}
