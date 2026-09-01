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

export function isGlm52Model(model: string): boolean {
  return /(?:^|\/)glm-5\.2(?:$|[-:])/u.test(model.toLowerCase());
}

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

export function applyGlmThinkingParameters(body: Record<string, unknown>, options: GlmThinkingOptions): boolean {
  if (!isGlmModel(options.model)) return false;
  const nativeEndpoint = isNativeGlmEndpoint(options.baseUrl);
  if (!nativeEndpoint && options.providerKind !== "nanogpt") return false;
  const thinkingEnabled = options.enableThinking === true || hasActiveReasoningEffort(options.reasoningEffort);

  if (nativeEndpoint && isGlm52Model(options.model)) {
    body.thinking = { type: thinkingEnabled ? "enabled" : "disabled" };
    const effort = glm52ReasoningEffort(options.reasoningEffort);
    if (thinkingEnabled && effort) body.reasoning_effort = effort;
    return true;
  }

  // GLM 5.3 always reasons and endpoints reject a disable with 400 ("please
  // use low, high, or max"). NanoGPT still requires the explicit flag;
  // elsewhere omit the field so the provider's always-on default applies.
  if (isGlm53MandatoryReasoningModel(options.model) && !thinkingEnabled) {
    if (options.providerKind === "nanogpt") body.enable_thinking = true;
    return true;
  }

  body.enable_thinking = thinkingEnabled;
  return true;
}
