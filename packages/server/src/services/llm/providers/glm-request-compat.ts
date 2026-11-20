import { isLocalInferenceBaseUrl } from "../../../middleware/ip-allowlist.js";

type GlmThinkingOptions = {
  model: string;
  baseUrl: string;
  providerKind: string;
  enableThinking?: boolean;
  reasoningEffort?: string | null;
};

export function isGlmModel(model: string): boolean {
  return model.toLowerCase().includes("glm");
}

/** GLM 4.5 and later, which can think. */
export function isGlmThinkingModel(model: string): boolean {
  return /(?:^|\/)glm-(?:4\.[5-9]|[5-9])/u.test(model.toLowerCase());
}

export function isGlm52Model(model: string): boolean {
  return /(?:^|\/)glm-5\.2(?:$|[-:])/u.test(model.toLowerCase());
}

/**
 * GLM 5.3 and every GLM 5.3 variant (Flash, provider suffixes such as
 * `:free`) always reason. Z.AI documents that disabling thinking is no longer
 * supported for the family and that only the `low`, `high`, and `max` effort
 * levels are accepted; OpenRouter and NanoGPT reject any disable request for
 * these models with HTTP 400.
 */
export function isGlm53MandatoryReasoningModel(model: string): boolean {
  return /(?:^|\/)glm-5\.3(?:$|[-:])/u.test(model.toLowerCase());
}

export function isNativeGlmEndpoint(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return (
      hostname === "api.z.ai" ||
      hostname.endsWith(".api.z.ai") ||
      hostname === "open.bigmodel.cn" ||
      hostname.endsWith(".open.bigmodel.cn")
    );
  } catch {
    return false;
  }
}

function hasActiveReasoningEffort(reasoningEffort?: string | null): boolean {
  return !!reasoningEffort && reasoningEffort !== "none";
}

function glm52ReasoningEffort(reasoningEffort?: string | null): "high" | "max" | null {
  if (!hasActiveReasoningEffort(reasoningEffort)) return null;
  return reasoningEffort === "max" || reasoningEffort === "xhigh" ? "max" : "high";
}

/**
 * Map Marinara's reasoning effort onto the three levels GLM 5.3 accepts. An
 * explicit reasoning-off request cannot be honored, so it becomes the lightest
 * level instead of a disable the provider rejects (Z.AI's own migration
 * guidance for `thinking.type: "disabled"`). No effort at all leaves the
 * provider default in place.
 */
export function glm53ReasoningEffort(reasoningEffort?: string | null): "low" | "high" | "max" | null {
  if (!reasoningEffort) return null;
  switch (reasoningEffort) {
    case "none":
    case "minimal":
    case "low":
      return "low";
    case "max":
    case "xhigh":
      return "max";
    default:
      return "high";
  }
}

export function applyGlmThinkingParameters(body: Record<string, unknown>, options: GlmThinkingOptions): boolean {
  if (!isGlmModel(options.model)) return false;
  const nativeEndpoint = options.providerKind === "zai" || isNativeGlmEndpoint(options.baseUrl);
  if (!nativeEndpoint && options.providerKind !== "nanogpt") return false;
  const thinkingEnabled = options.enableThinking === true || hasActiveReasoningEffort(options.reasoningEffort);

  if (isGlm53MandatoryReasoningModel(options.model)) {
    if (nativeEndpoint) {
      body.thinking = { type: "enabled" };
    } else {
      body.enable_thinking = true;
    }
    const effort = glm53ReasoningEffort(options.reasoningEffort);
    if (effort) body.reasoning_effort = effort;
    return true;
  }

  if (nativeEndpoint) {
    // Thinking starts with GLM 4.5; older GLM models on Z.AI get no thinking field at all.
    if (!isGlmThinkingModel(options.model)) return true;
    // Z.AI's own API turns thinking on and off with `thinking.type` and has no `enable_thinking` field; only GLM 5.2
    // and later take an effort. https://docs.z.ai/api-reference/llm/chat-completion
    body.thinking = { type: thinkingEnabled ? "enabled" : "disabled" };
    const effort = isGlm52Model(options.model) ? glm52ReasoningEffort(options.reasoningEffort) : null;
    if (thinkingEnabled && effort) body.reasoning_effort = effort;
    return true;
  }

  // Native Z.ai uses thinking.type; gateway hosts retain their own switch.
  // https://docs.z.ai/api-reference/llm/chat-completion
  if (nativeEndpoint) body.thinking = { type: thinkingEnabled ? "enabled" : "disabled" };
  else body.enable_thinking = thinkingEnabled;
  // NanoGPT documents reasoning_effort "none" as the way to turn reasoning off. enable_thinking alone
  // left GLM thinking at its default, so an explicit Off is sent the documented way too (#6961).
  if (!nativeEndpoint && !thinkingEnabled && options.reasoningEffort === "none") body.reasoning_effort = "none";
  return true;
}

/**
 * Reasoning value a generic custom connection should send in place of an
 * explicit "none" for GLM 5.3. Remote gateways forward the request to a
 * provider that rejects the disable, so they get the lightest accepted level.
 * Local inference servers (llama.cpp, vLLM, Ollama) serve the open weights
 * with a chat template that can actually turn thinking off, so they keep the
 * pre-existing "none" (and the enable_thinking template kwarg that follows).
 * A configured effort is forwarded mapped onto low/high/max; no configured
 * effort stays omitted. Returns null when no substitution applies.
 */
export function glm53CustomGatewayReasoningEffort(
  model: string,
  baseUrl: string,
  reasoningEffort?: string | null,
): "low" | "high" | "max" | null {
  if (!reasoningEffort) return null;
  if (!isGlm53MandatoryReasoningModel(model)) return null;
  if (isLocalInferenceBaseUrl(baseUrl)) return null;
  return glm53ReasoningEffort(reasoningEffort);
}
