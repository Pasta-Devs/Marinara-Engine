import type { GenerationPromptSnapshotInfo } from "../contracts/types/chat";
import { boolish, parseRecord, readNumber, readString, type JsonRecord } from "./runtime-records";

function parameterNumber(parameters: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = parameters[key];
    const parsed = readNumber(value, NaN);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parameterInteger(parameters: JsonRecord, keys: string[]): number | null {
  const value = parameterNumber(parameters, keys);
  return value !== null && Number.isInteger(value) ? value : null;
}

function parameterString(parameters: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = readString(parameters[key]).trim();
    if (value) return value;
  }
  return null;
}

function stopSequences(parameters: JsonRecord): string[] | null {
  const value = parameters.stop ?? parameters.stopSequences ?? parameters.stop_sequences;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return null;
  const stops = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return stops.length > 0 ? stops.map((entry) => entry.trim()) : null;
}

function requestMaxTokens(connection: JsonRecord, parameters: JsonRecord, fallback = 1024): number {
  const requested =
    parameterNumber(parameters, ["maxTokens", "max_tokens", "maxOutputTokens", "max_output_tokens"]) ?? fallback;
  const cap = parameterNumber(connection, ["maxTokensOverride", "max_tokens_override"]);
  return cap !== null && cap > 0 ? Math.min(requested, cap) : requested;
}

function claudeVersionParts(model: string, family: string): [number, number] | null {
  const normalized = model.toLowerCase();
  const marker = `claude-${family}-`;
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) return null;
  const tail = normalized.slice(markerIndex + marker.length);
  const parts = tail
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((part) => Number.isInteger(part))
    .slice(0, 2);
  const major = parts[0];
  if (major == null) return null;
  const minor = parts[1] != null && parts[1] <= 99 ? parts[1] : 0;
  return [major, minor];
}

function claudeVersionAtLeast(model: string, family: string, major: number, minor: number): boolean {
  const parts = claudeVersionParts(model, family);
  if (!parts) return false;
  const [modelMajor, modelMinor] = parts;
  return modelMajor > major || (modelMajor === major && modelMinor >= minor);
}

function isClaudeOpusAdaptiveOnlyModel(model: string): boolean {
  return claudeVersionAtLeast(model, "opus", 4, 7);
}

function isAnthropicSamplingRestrictedModel(model: string): boolean {
  return (
    claudeVersionAtLeast(model, "opus", 4, 7) ||
    claudeVersionAtLeast(model, "sonnet", 4, 6) ||
    claudeVersionAtLeast(model, "haiku", 4, 5)
  );
}

function supportsAnthropicAdaptiveThinking(model: string): boolean {
  return claudeVersionAtLeast(model, "opus", 4, 6) || claudeVersionAtLeast(model, "sonnet", 4, 6);
}

function shouldSendOpenAiSamplingParameters(model: string): boolean {
  return !isAnthropicSamplingRestrictedModel(model);
}

function isSamplingParameterKey(key: string): boolean {
  return [
    "temperature",
    "top_p",
    "topP",
    "top_k",
    "topK",
    "frequency_penalty",
    "frequencyPenalty",
    "presence_penalty",
    "presencePenalty",
  ].includes(key);
}

function isStopParameterKey(key: string): boolean {
  return ["stop", "stopSequences", "stop_sequences"].includes(key);
}

function isReservedCustomParameterKey(key: string): boolean {
  return ["model", "messages", "input", "contents", "systemInstruction", "stream", "tools"].includes(key);
}

function isOpenAiResponsesUnsupportedCustomParameterKey(key: string): boolean {
  return [
    "top_k",
    "topK",
    "frequency_penalty",
    "frequencyPenalty",
    "presence_penalty",
    "presencePenalty",
    "stop",
    "stopSequences",
    "stop_sequences",
  ].includes(key);
}

function isMistralUnsupportedCustomParameterKey(key: string): boolean {
  return [
    "seed",
    "top_k",
    "topK",
    "safePrompt",
    "randomSeed",
    "promptCacheKey",
    "promptMode",
    "parallelToolCalls",
    "reasoningEffort",
    "responseFormat",
    "service_tier",
    "serviceTier",
  ].includes(key);
}

function isCohereUnsupportedCustomParameterKey(key: string): boolean {
  return [
    "maxTokens",
    "maxOutputTokens",
    "max_output_tokens",
    "topP",
    "top_p",
    "topK",
    "top_k",
    "stop",
    "stopSequences",
    "frequencyPenalty",
    "presencePenalty",
    "responseFormat",
    "safetyMode",
    "toolChoice",
    "strictTools",
    "reasoningEffort",
    "reasoning_effort",
    "showThoughts",
    "show_thoughts",
    "thinkingBudget",
    "thinking_budget",
    "random_seed",
    "randomSeed",
    "safe_prompt",
    "safePrompt",
    "prompt_cache_key",
    "promptCacheKey",
    "prompt_mode",
    "promptMode",
    "parallel_tool_calls",
    "parallelToolCalls",
    "service_tier",
    "serviceTier",
    "prediction",
  ].includes(key);
}

function isCohereContextBlockedCustomParameterKey(key: string, hasTools: boolean): boolean {
  if (hasTools) return ["response_format", "safety_mode"].includes(key);
  return ["tool_choice", "strict_tools"].includes(key);
}

function xAiModelId(model: string): string {
  return model
    .toLowerCase()
    .trim()
    .replace(/^xai\//, "");
}

function isXAiGrok43Model(model: string): boolean {
  const id = xAiModelId(model);
  return id === "latest" || id === "grok-4.3" || id.startsWith("grok-4.3-");
}

function isXAiMultiAgentModel(model: string): boolean {
  return xAiModelId(model).startsWith("grok-4.20-multi-agent");
}

function isXAiAutomaticReasoningModel(model: string): boolean {
  const id = xAiModelId(model);
  if (isXAiGrok43Model(model) || isXAiMultiAgentModel(model)) return true;
  if (id.startsWith("grok-build")) return false;
  return id.startsWith("grok-4") && !id.includes("image");
}

function xAiReasoningEffort(model: string, parameters: JsonRecord): string | null {
  if (!isXAiGrok43Model(model)) return null;
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"])?.toLowerCase();
  if (!effort) return null;
  if (effort === "minimal") return "low";
  if (effort === "maximum" || effort === "xhigh") return "high";
  if (["none", "low", "medium", "high"].includes(effort)) return effort;
  return null;
}

function xAiReasoningConfig(model: string, parameters: JsonRecord): Record<string, unknown> | null {
  if (!isXAiMultiAgentModel(model)) return null;
  const explicit = parameters.reasoning;
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) return explicit as Record<string, unknown>;
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"])?.toLowerCase();
  if (effort === "high" || effort === "xhigh" || effort === "maximum") {
    return { effort: effort === "maximum" ? "xhigh" : effort };
  }
  if (effort === "low" || effort === "medium" || effort === "minimal") {
    return { effort: effort === "minimal" ? "low" : effort };
  }
  return null;
}

function xAiReasoningActive(model: string, parameters: JsonRecord): boolean {
  const effort = xAiReasoningEffort(model, parameters);
  if (effort === "none") return false;
  if (effort) return true;
  return isXAiAutomaticReasoningModel(model);
}

function isXAiGrok420OrNewerModel(model: string): boolean {
  const id = xAiModelId(model);
  return id.startsWith("grok-4.20") || id.startsWith("grok-4.3");
}

function isXAiUnsupportedCustomParameterKey(key: string, model: string, reasoningActive: boolean): boolean {
  if (
    [
      "top_k",
      "topK",
      "reasoningEffort",
      "reasoning_effort",
      "serviceTier",
      "service_tier",
      "parallelToolCalls",
      "parallel_tool_calls",
    ].includes(key)
  ) {
    return true;
  }
  if (
    reasoningActive &&
    [
      "frequencyPenalty",
      "frequency_penalty",
      "presencePenalty",
      "presence_penalty",
      "stop",
      "stopSequences",
      "stop_sequences",
    ].includes(key)
  ) {
    return true;
  }
  if (isXAiGrok420OrNewerModel(model) && ["logprobs", "topLogprobs", "top_logprobs"].includes(key)) return true;
  return false;
}

function isOpenRouterOpenAiModel(model: string): boolean {
  const normalized = model.toLowerCase().trim().replace(/^~/, "");
  if (normalized.startsWith("openai/")) return true;
  if (normalized.includes("/")) return false;
  return /^(gpt-|o1|o3|o4|o\d|codex)/.test(normalized);
}

function shouldSendTopK(provider: string, model: string): boolean {
  if (provider === "openrouter") return !isOpenRouterOpenAiModel(model);
  return !["openai", "xai", "mistral", "cohere"].includes(provider);
}

function shouldUseOpenAiResponses(provider: string, model: string): boolean {
  if (provider === "openai_chatgpt") return true;
  if (provider !== "openai") return false;
  const normalized = model.toLowerCase();
  return (
    normalized.startsWith("gpt-5") ||
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4") ||
    normalized.includes("computer-use") ||
    normalized.includes("codex")
  );
}

function openAiModelId(model: string): string {
  return model.toLowerCase().split("/").pop() ?? "";
}

function gpt5MinorVersion(model: string): number | null {
  const match = /^gpt-5\.(\d+)/.exec(openAiModelId(model));
  if (!match) return null;
  return Number(match[1]);
}

function isOpenAiLegacyGpt5ProModel(model: string): boolean {
  const id = openAiModelId(model);
  return id === "gpt-5-pro" || id.startsWith("gpt-5-pro-");
}

function isOpenAiVersionedGpt5ProModel(model: string): boolean {
  return /^gpt-5\.\d+-pro(?:-|$)/.test(openAiModelId(model));
}

function supportsOpenAiNoneReasoningModel(model: string): boolean {
  const id = openAiModelId(model);
  if (id.includes("codex") || isOpenAiLegacyGpt5ProModel(id) || isOpenAiVersionedGpt5ProModel(id)) return false;
  const minor = gpt5MinorVersion(model);
  return minor !== null && minor >= 1;
}

function supportsOpenAiMinimalReasoningModel(model: string): boolean {
  const id = openAiModelId(model);
  return (
    !id.includes("codex") &&
    !isOpenAiLegacyGpt5ProModel(id) &&
    !isOpenAiVersionedGpt5ProModel(id) &&
    /^gpt-5(?:-|$)/.test(id)
  );
}

function supportsOpenAiXhighReasoningModel(model: string): boolean {
  const id = openAiModelId(model);
  if (id === "gpt-5-pro" || id.startsWith("gpt-5-pro-")) return false;
  if (id === "gpt-5.1-codex-max" || id.startsWith("gpt-5.1-codex-max-")) return true;
  const minor = gpt5MinorVersion(id);
  return minor !== null && minor >= 2;
}

function openAiReasoningEffort(model: string, parameters: JsonRecord): string | null {
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"])?.toLowerCase();
  if (!effort) return null;
  if (isOpenAiLegacyGpt5ProModel(model)) return "high";
  if (isOpenAiVersionedGpt5ProModel(model)) {
    if (effort === "xhigh" || effort === "maximum") return "xhigh";
    if (effort === "high") return "high";
    return "medium";
  }
  if (effort === "none") return supportsOpenAiNoneReasoningModel(model) ? "none" : null;
  if (effort === "minimal") return supportsOpenAiMinimalReasoningModel(model) ? "minimal" : null;
  if (["low", "medium", "high"].includes(effort)) return effort;
  if (effort === "maximum" || effort === "xhigh") return supportsOpenAiXhighReasoningModel(model) ? "xhigh" : "high";
  return null;
}

function supportsMistralAdjustableReasoning(model: string): boolean {
  const normalized = model.toLowerCase();
  return (
    normalized === "mistral-small-latest" || normalized === "mistral-small-2603" || normalized === "mistral-medium-3-5"
  );
}

function mistralReasoningEffort(model: string, parameters: JsonRecord): string | null {
  if (!supportsMistralAdjustableReasoning(model)) return null;
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"])?.toLowerCase();
  if (effort === "none" || effort === "minimal" || effort === "low") return "none";
  if (effort === "high" || effort === "maximum" || effort === "xhigh") return "high";
  const showThoughts = parameters.showThoughts ?? parameters.show_thoughts;
  if (showThoughts != null) return boolish(showThoughts, false) ? "high" : "none";
  return null;
}

function supportsCohereThinking(model: string): boolean {
  const normalized = model.toLowerCase();
  return normalized.includes("command-a-reasoning") || normalized.includes("command-a-plus");
}

function cohereThinkingConfig(model: string, parameters: JsonRecord): Record<string, unknown> | null {
  const explicit = parseRecord(parameters.thinking);
  if (Object.keys(explicit).length > 0) return explicit;
  if (!supportsCohereThinking(model)) return null;

  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"])?.toLowerCase();
  if (effort === "none" || effort === "minimal" || effort === "low") return { type: "disabled" };

  const budget = parameterInteger(parameters, ["thinkingBudget", "thinking_budget"]);
  const showThoughts = parameters.showThoughts ?? parameters.show_thoughts;
  if (budget !== null && budget > 0) {
    const thinking: Record<string, unknown> = { token_budget: budget };
    if (
      boolish(showThoughts, true) ||
      effort === "medium" ||
      effort === "high" ||
      effort === "maximum" ||
      effort === "xhigh"
    ) {
      thinking.type = "enabled";
    }
    return thinking;
  }
  if (showThoughts != null) return boolish(showThoughts, false) ? { type: "enabled" } : { type: "disabled" };
  if (effort === "medium" || effort === "high" || effort === "maximum" || effort === "xhigh")
    return { type: "enabled" };
  return null;
}

function anthropicThinkingEffort(model: string, parameters: JsonRecord): string | null {
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"])?.toLowerCase();
  if (!effort) return null;
  if (["low", "medium", "high"].includes(effort)) return effort;
  if (effort === "xhigh") return isClaudeOpusAdaptiveOnlyModel(model) ? "xhigh" : "high";
  if (effort === "maximum" || effort === "max") return "max";
  return null;
}

function anthropicThinkingBudgetTokens(effort: string): number {
  if (effort === "low") return 1024;
  if (effort === "medium") return 8192;
  return 24576;
}

function shouldUseAnthropicAdaptiveThinking(model: string, parameters: JsonRecord, effort: string | null): boolean {
  if (!supportsAnthropicAdaptiveThinking(model)) return false;
  if (isClaudeOpusAdaptiveOnlyModel(model)) return true;
  if (effort) return true;
  const showThoughts = parameters.showThoughts ?? parameters.show_thoughts;
  if (showThoughts != null) return boolish(showThoughts, false);
  return false;
}

function isGemini3Model(model: string): boolean {
  const normalized = model.toLowerCase();
  return (
    normalized.startsWith("gemini-3") || normalized.startsWith("google/gemini-3") || normalized.includes("/gemini-3")
  );
}

function isGemini3ProModel(model: string): boolean {
  const normalized = model.toLowerCase();
  return isGemini3Model(normalized) && normalized.includes("-pro");
}

function isGemini25Model(model: string): boolean {
  const normalized = model.toLowerCase();
  return (
    normalized.startsWith("gemini-2.5") ||
    normalized.startsWith("google/gemini-2.5") ||
    normalized.includes("/gemini-2.5")
  );
}

function isGemini25ProModel(model: string): boolean {
  const normalized = model.toLowerCase();
  return isGemini25Model(normalized) && normalized.includes("-pro");
}

function googleThinkingLevel(model: string, parameters: JsonRecord): string | null {
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"])?.toLowerCase();
  if (!effort) return null;
  if (["none", "minimal"].includes(effort)) return isGemini3ProModel(model) ? "low" : "minimal";
  if (["low", "medium"].includes(effort)) return effort;
  if (["high", "maximum", "xhigh"].includes(effort)) return "high";
  return null;
}

function googleThinkingBudget(model: string, parameters: JsonRecord): number | null {
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"])?.toLowerCase();
  if (!effort) return null;
  const pro = isGemini25ProModel(model);
  if (effort === "none" || effort === "minimal") return pro ? 128 : 0;
  if (effort === "low") return 1024;
  if (effort === "medium") return 8192;
  if (["high", "maximum", "xhigh"].includes(effort)) return pro ? 32768 : 24576;
  return null;
}

function googleThinkingConfig(model: string, parameters: JsonRecord): Record<string, unknown> | null {
  if (isGemini3Model(model)) {
    const level = googleThinkingLevel(model, parameters);
    return level ? { thinkingLevel: level, includeThoughts: true } : null;
  }

  if (isGemini25Model(model)) {
    const budget = googleThinkingBudget(model, parameters);
    return budget !== null ? { thinkingBudget: budget, includeThoughts: true } : null;
  }

  return null;
}

function isGoogleGemini3UnsupportedGenerationConfigKey(key: string): boolean {
  return ["temperature", "topP", "top_p", "topK", "top_k", "candidateCount", "candidate_count"].includes(key);
}

function isGoogleGenerationConfigCustomParameterKey(key: string): boolean {
  return [
    "stopSequences",
    "stop_sequences",
    "responseMimeType",
    "response_mime_type",
    "responseModalities",
    "response_modalities",
    "thinkingConfig",
    "thinking_config",
    "modelConfig",
    "model_config",
    "temperature",
    "topP",
    "top_p",
    "topK",
    "top_k",
    "candidateCount",
    "candidate_count",
    "maxOutputTokens",
    "max_output_tokens",
    "responseLogprobs",
    "response_logprobs",
    "logprobs",
    "presencePenalty",
    "presence_penalty",
    "frequencyPenalty",
    "frequency_penalty",
    "seed",
    "responseSchema",
    "response_schema",
    "responseJsonSchema",
    "response_json_schema",
    "routingConfig",
    "routing_config",
    "audioTimestamp",
    "audio_timestamp",
    "mediaResolution",
    "media_resolution",
    "speechConfig",
    "speech_config",
    "enableAffectiveDialog",
    "enable_affective_dialog",
    "enableEnhancedCivicAnswers",
    "enable_enhanced_civic_answers",
    "imageConfig",
    "image_config",
    "responseFormat",
    "response_format",
  ].includes(key);
}

function applyCustomParameters(
  body: Record<string, unknown>,
  parameters: JsonRecord,
  options: {
    stripSampling: boolean;
    stripStop?: boolean;
    skipKeys?: readonly string[];
    skipKey?: (key: string) => boolean;
  },
): void {
  const custom = parseRecord(parameters.customParameters ?? parameters.custom_params);
  const skipKeys = new Set(options.skipKeys ?? []);
  for (const [key, value] of Object.entries(custom)) {
    if (skipKeys.has(key) || options.skipKey?.(key) || isReservedCustomParameterKey(key)) continue;
    if (options.stripSampling && isSamplingParameterKey(key)) continue;
    if (options.stripStop === true && isStopParameterKey(key)) continue;
    if (body[key] == null) body[key] = value;
  }
}

function visibleAnthropicParameters(
  connection: JsonRecord,
  parameters: JsonRecord,
  options: { stream?: boolean },
): Record<string, unknown> {
  const model = readString(connection.model);
  const samplingRestricted = isAnthropicSamplingRestrictedModel(model);
  const effort = anthropicThinkingEffort(model, parameters);
  const adaptiveThinking = shouldUseAnthropicAdaptiveThinking(model, parameters, effort);
  const sendTemperatureAndTopK = !samplingRestricted && !adaptiveThinking;
  const body: Record<string, unknown> = {
    max_tokens: requestMaxTokens(connection, parameters),
  };
  if (options.stream) body.stream = true;
  if (sendTemperatureAndTopK) {
    const temperature = parameterNumber(parameters, ["temperature"]);
    if (temperature !== null) body.temperature = temperature;
  }
  const topP = parameterNumber(parameters, ["topP", "top_p"]);
  if (!samplingRestricted && topP !== null && (!adaptiveThinking || topP >= 0.95)) body.top_p = topP;
  if (sendTemperatureAndTopK) {
    const topK = parameterInteger(parameters, ["topK", "top_k"]);
    if (topK !== null) body.top_k = topK;
  }
  if (adaptiveThinking) {
    body.thinking = { type: "adaptive", display: "summarized" };
    if (effort) body.output_config = { effort };
  } else if (effort) {
    const budgetTokens = anthropicThinkingBudgetTokens(effort);
    body.thinking = { type: "enabled", budget_tokens: budgetTokens };
    body.max_tokens = requestMaxTokens(connection, parameters) + budgetTokens;
  }
  const serviceTier = parameterString(parameters, ["serviceTier", "service_tier"]);
  if (serviceTier && isAnthropicServiceTier(serviceTier)) body.service_tier = serviceTier;
  const stop = stopSequences(parameters);
  if (stop) body.stop_sequences = stop;
  applyCustomParameters(body, parameters, {
    stripSampling: samplingRestricted || adaptiveThinking,
    stripStop: false,
  });
  return body;
}

function visibleOpenAiResponsesParameters(
  connection: JsonRecord,
  parameters: JsonRecord,
  options: { stream?: boolean },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    stream: options.stream === true,
    max_output_tokens: requestMaxTokens(connection, parameters),
  };
  const effort = openAiReasoningEffort(readString(connection.model), parameters);
  if (effort) body.reasoning = { effort, summary: "auto" };
  const temperature = parameterNumber(parameters, ["temperature"]);
  if (temperature !== null) body.temperature = temperature;
  const topP = parameterNumber(parameters, ["topP", "top_p"]);
  if (topP !== null) body.top_p = topP;
  const serviceTier = parameterString(parameters, ["serviceTier", "service_tier"]);
  if (serviceTier && isOpenAiServiceTier(serviceTier)) body.service_tier = serviceTier;
  const responseFormat = parameterString(parameters, ["responseFormat", "response_format"]);
  const verbosity = parameterString(parameters, ["verbosity"]);
  if (responseFormat === "json_object" || verbosity) {
    const text: Record<string, unknown> = {};
    if (responseFormat === "json_object") text.format = { type: "json_object" };
    if (verbosity) text.verbosity = verbosity;
    body.text = text;
  }
  applyCustomParameters(body, parameters, {
    stripSampling: false,
    stripStop: false,
    skipKey: isOpenAiResponsesUnsupportedCustomParameterKey,
  });
  return body;
}

function isOpenAiServiceTier(value: string): boolean {
  return ["auto", "default", "flex", "scale", "priority"].includes(value);
}

function isOpenRouterServiceTier(value: string): boolean {
  return ["flex", "priority"].includes(value);
}

function isXAiServiceTier(value: string): boolean {
  return ["default", "priority"].includes(value);
}

function isOpenRouterVerbosity(value: string): boolean {
  return ["low", "medium", "high", "xhigh", "max"].includes(value);
}

function openRouterReasoningEffort(parameters: JsonRecord): string | null {
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"])?.toLowerCase();
  if (!effort) return null;
  if (effort === "maximum") return "xhigh";
  if (["none", "minimal", "low", "medium", "high", "xhigh"].includes(effort)) return effort;
  return null;
}

function openRouterReasoningConfig(parameters: JsonRecord): Record<string, unknown> | null {
  const explicit = parameters.reasoning;
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) return explicit as Record<string, unknown>;
  const custom = parseRecord(parameters.customParameters ?? parameters.custom_params);
  if (custom.reasoning && typeof custom.reasoning === "object" && !Array.isArray(custom.reasoning)) return null;
  const budget = parameterInteger(parameters, [
    "thinkingBudget",
    "thinking_budget",
    "reasoningMaxTokens",
    "reasoning_max_tokens",
  ]);
  if (budget !== null && budget > 0) return { max_tokens: budget };
  const effort = openRouterReasoningEffort(parameters);
  return effort ? { effort } : null;
}

function nanoGptReasoningEffort(parameters: JsonRecord): string | null {
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"])?.toLowerCase();
  if (!effort) return null;
  if (effort === "maximum") return "xhigh";
  if (["none", "minimal", "low", "medium", "high", "xhigh"].includes(effort)) return effort;
  return null;
}

function nanoGptPromptCachingConfig(parameters: JsonRecord): unknown {
  const promptCaching = parameters.promptCaching ?? parameters.prompt_caching;
  if (promptCaching && typeof promptCaching === "object" && !Array.isArray(promptCaching)) return promptCaching;
  if (promptCaching != null) return { enabled: boolish(promptCaching, false) };
  return null;
}

function nanoGptReasoningConfig(parameters: JsonRecord): Record<string, unknown> | null {
  const explicit = parameters.reasoning;
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) return explicit as Record<string, unknown>;
  const custom = parseRecord(parameters.customParameters ?? parameters.custom_params);
  if (custom.reasoning && typeof custom.reasoning === "object" && !Array.isArray(custom.reasoning)) return null;

  const reasoning: Record<string, unknown> = {};
  const showThoughts = parameters.showThoughts ?? parameters.show_thoughts;
  if (showThoughts != null) reasoning.exclude = !boolish(showThoughts, false);
  return Object.keys(reasoning).length > 0 ? reasoning : null;
}

function isAnthropicServiceTier(value: string): boolean {
  return ["auto", "standard_only"].includes(value);
}

function isCohereSafetyMode(value: string): boolean {
  return ["CONTEXTUAL", "STRICT", "OFF"].includes(value);
}

function cohereToolChoice(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "required" || normalized === "any") return "REQUIRED";
  if (normalized === "none") return "NONE";
  return null;
}

function visibleCohereParameters(
  connection: JsonRecord,
  parameters: JsonRecord,
  options: { stream?: boolean; hasTools?: boolean },
): Record<string, unknown> {
  const model = readString(connection.model);
  const hasTools = options.hasTools === true;
  const body: Record<string, unknown> = {
    stream: options.stream === true,
    max_tokens: requestMaxTokens(connection, parameters),
  };

  const temperature = parameterNumber(parameters, ["temperature"]);
  if (temperature !== null) body.temperature = temperature;
  const topP = parameterNumber(parameters, ["topP", "top_p", "p"]);
  if (topP !== null) body.p = topP;
  const topK = parameterInteger(parameters, ["topK", "top_k", "k"]);
  if (topK !== null && topK >= 0) body.k = topK;
  const frequencyPenalty = parameterNumber(parameters, ["frequencyPenalty", "frequency_penalty"]);
  if (frequencyPenalty !== null) body.frequency_penalty = frequencyPenalty;
  const presencePenalty = parameterNumber(parameters, ["presencePenalty", "presence_penalty"]);
  if (presencePenalty !== null) body.presence_penalty = presencePenalty;
  const seed = parameterInteger(parameters, ["seed"]);
  if (seed !== null) body.seed = seed;
  const stop = stopSequences(parameters);
  if (stop) body.stop_sequences = stop;

  if (!hasTools) {
    const responseFormat = parameters.response_format ?? parameters.responseFormat;
    if (typeof responseFormat === "string" && responseFormat.trim()) {
      body.response_format = { type: responseFormat.trim() };
    } else if (responseFormat && typeof responseFormat === "object" && !Array.isArray(responseFormat)) {
      body.response_format = responseFormat;
    }
  }

  if (!hasTools) {
    const safetyMode = parameterString(parameters, ["safetyMode", "safety_mode"])?.toUpperCase();
    if (safetyMode && isCohereSafetyMode(safetyMode)) body.safety_mode = safetyMode;
  }
  const logprobs = parameters.logprobs ?? parameters.logProbs;
  if (logprobs != null) body.logprobs = boolish(logprobs, false);
  if (hasTools) {
    const toolChoice = parameterString(parameters, ["toolChoice", "tool_choice"]);
    const cohereChoice = toolChoice ? cohereToolChoice(toolChoice) : null;
    if (cohereChoice) body.tool_choice = cohereChoice;
  }
  const priority = parameterInteger(parameters, ["priority"]);
  if (priority !== null && priority >= 0 && priority <= 999) body.priority = priority;
  if (hasTools) {
    const strictTools = parameters.strictTools ?? parameters.strict_tools;
    if (strictTools != null) body.strict_tools = boolish(strictTools, false);
  }
  const thinking = cohereThinkingConfig(model, parameters);
  if (thinking) body.thinking = thinking;

  applyCustomParameters(body, parameters, {
    stripSampling: false,
    stripStop: false,
    skipKey: (key) =>
      isCohereUnsupportedCustomParameterKey(key) || isCohereContextBlockedCustomParameterKey(key, hasTools),
  });
  return body;
}

function visibleOpenAiCompatibleParameters(
  connection: JsonRecord,
  parameters: JsonRecord,
  options: { stream?: boolean; hasTools?: boolean },
): Record<string, unknown> {
  const provider = readString(connection.provider).trim();
  const model = readString(connection.model);
  if (shouldUseOpenAiResponses(provider, model)) {
    return visibleOpenAiResponsesParameters(connection, parameters, options);
  }

  const sendSampling = shouldSendOpenAiSamplingParameters(model);
  const xaiReasoningActive = provider === "xai" && xAiReasoningActive(model, parameters);
  const body: Record<string, unknown> = {
    stream: options.stream === true,
    max_tokens: requestMaxTokens(connection, parameters),
  };
  if (sendSampling) {
    const temperature = parameterNumber(parameters, ["temperature"]);
    if (temperature !== null) body.temperature = temperature;
    const topP = parameterNumber(parameters, ["topP", "top_p"]);
    if (topP !== null) body.top_p = topP;
    const topK = parameterInteger(parameters, ["topK", "top_k"]);
    if (topK !== null && topK > 0 && shouldSendTopK(provider, model)) body.top_k = topK;
    const frequencyPenalty = parameterNumber(parameters, ["frequencyPenalty", "frequency_penalty"]);
    if (frequencyPenalty !== null && !xaiReasoningActive) body.frequency_penalty = frequencyPenalty;
    const presencePenalty = parameterNumber(parameters, ["presencePenalty", "presence_penalty"]);
    if (presencePenalty !== null && !xaiReasoningActive) body.presence_penalty = presencePenalty;
    if (provider === "openrouter" || provider === "nanogpt") {
      const minP = parameterNumber(parameters, ["minP", "min_p"]);
      if (minP !== null && minP >= 0 && minP <= 1) body.min_p = minP;
      const topA = parameterNumber(parameters, ["topA", "top_a"]);
      if (topA !== null && topA >= 0 && topA <= 1) body.top_a = topA;
      const repetitionPenalty = parameterNumber(parameters, ["repetitionPenalty", "repetition_penalty"]);
      if (repetitionPenalty !== null && repetitionPenalty >= 0 && repetitionPenalty <= 2)
        body.repetition_penalty = repetitionPenalty;
      if (provider === "nanogpt") {
        const tfs = parameterNumber(parameters, ["tfs"]);
        if (tfs !== null && tfs >= 0 && tfs <= 1) body.tfs = tfs;
        const etaCutoff = parameterNumber(parameters, ["etaCutoff", "eta_cutoff"]);
        if (etaCutoff !== null) body.eta_cutoff = etaCutoff;
        const epsilonCutoff = parameterNumber(parameters, ["epsilonCutoff", "epsilon_cutoff"]);
        if (epsilonCutoff !== null) body.epsilon_cutoff = epsilonCutoff;
        const typicalP = parameterNumber(parameters, ["typicalP", "typical_p"]);
        if (typicalP !== null && typicalP >= 0 && typicalP <= 1) body.typical_p = typicalP;
        const mirostatMode = parameterInteger(parameters, ["mirostatMode", "mirostat_mode"]);
        if (mirostatMode !== null && mirostatMode >= 0 && mirostatMode <= 2) body.mirostat_mode = mirostatMode;
        const mirostatTau = parameterNumber(parameters, ["mirostatTau", "mirostat_tau"]);
        if (mirostatTau !== null) body.mirostat_tau = mirostatTau;
        const mirostatEta = parameterNumber(parameters, ["mirostatEta", "mirostat_eta"]);
        if (mirostatEta !== null) body.mirostat_eta = mirostatEta;
      }
    }
  }
  const seed = parameterInteger(parameters, ["seed"]);
  if (seed !== null) {
    if (provider === "mistral") {
      body.random_seed = seed;
    } else {
      body.seed = seed;
    }
  }
  if (sendSampling) {
    const stop = stopSequences(parameters);
    if (stop && !xaiReasoningActive) body.stop = stop;
  }
  const responseFormat = parameterString(parameters, ["responseFormat", "response_format"]);
  if (responseFormat) body.response_format = { type: responseFormat };

  if (provider === "openrouter") {
    const reasoning = openRouterReasoningConfig(parameters);
    if (reasoning) body.reasoning = reasoning;
    const openrouterProvider = readString(connection.openrouterProvider ?? connection.openrouter_provider).trim();
    if (openrouterProvider) body.provider = { order: [openrouterProvider] };
    if (
      boolish(connection.enableCaching ?? connection.enable_caching, false) &&
      model.toLowerCase().includes("claude")
    ) {
      body.cache_control = { type: "ephemeral" };
    }
    const serviceTier = parameterString(parameters, ["serviceTier", "service_tier"]);
    if (serviceTier && isOpenRouterServiceTier(serviceTier)) body.service_tier = serviceTier;
    const verbosity = parameterString(parameters, ["verbosity"]);
    if (verbosity && isOpenRouterVerbosity(verbosity)) body.verbosity = verbosity;
    const parallelToolCalls = parameters.parallelToolCalls ?? parameters.parallel_tool_calls;
    if (options.hasTools === true && parallelToolCalls != null)
      body.parallel_tool_calls = boolish(parallelToolCalls, true);
  } else if (provider === "xai") {
    const effort = xAiReasoningEffort(model, parameters);
    if (effort) body.reasoning_effort = effort;
    const reasoning = xAiReasoningConfig(model, parameters);
    if (reasoning) body.reasoning = reasoning;
    const serviceTier = parameterString(parameters, ["serviceTier", "service_tier"]);
    if (serviceTier && isXAiServiceTier(serviceTier)) body.service_tier = serviceTier;
    const parallelToolCalls = parameters.parallelToolCalls ?? parameters.parallel_tool_calls;
    if (options.hasTools === true && parallelToolCalls != null)
      body.parallel_tool_calls = boolish(parallelToolCalls, true);
  } else if (provider === "nanogpt") {
    const effort = nanoGptReasoningEffort(parameters);
    if (effort) body.reasoning_effort = effort;
    const reasoning = nanoGptReasoningConfig(parameters);
    if (reasoning) body.reasoning = reasoning;
    const promptCaching = nanoGptPromptCachingConfig(parameters);
    if (promptCaching) body.prompt_caching = promptCaching;
    const caching =
      parameters.caching ?? (boolish(connection.enableCaching ?? connection.enable_caching, false) ? true : null);
    if (caching != null) body.caching = boolish(caching, false);
    const stickyProvider = parameters.stickyProvider ?? parameters.stickyprovider;
    if (stickyProvider != null) body.stickyProvider = boolish(stickyProvider, true);
    const providerOverride = parameters.nanoGptProvider ?? parameters.nano_gpt_provider ?? parameters.provider;
    if (providerOverride != null) body.provider = providerOverride;
    const billingMode = parameterString(parameters, ["billingMode", "billing_mode"]);
    if (billingMode) body.billing_mode = billingMode;
    const minTokens = parameterInteger(parameters, ["minTokens", "min_tokens"]);
    if (minTokens !== null && minTokens >= 0) body.min_tokens = minTokens;
    const includeStop = parameters.includeStopStrInOutput ?? parameters.include_stop_str_in_output;
    if (includeStop != null) body.include_stop_str_in_output = boolish(includeStop, false);
    const ignoreEos = parameters.ignoreEos ?? parameters.ignore_eos;
    if (ignoreEos != null) body.ignore_eos = boolish(ignoreEos, false);
    const noRepeatNgramSize = parameterInteger(parameters, ["noRepeatNgramSize", "no_repeat_ngram_size"]);
    if (noRepeatNgramSize !== null && noRepeatNgramSize >= 0) body.no_repeat_ngram_size = noRepeatNgramSize;
    const stopTokenIds = parameters.stopTokenIds ?? parameters.stop_token_ids;
    if (Array.isArray(stopTokenIds) && stopTokenIds.every((value) => Number.isInteger(value)))
      body.stop_token_ids = stopTokenIds;
    const customTokenBans = parameters.customTokenBans ?? parameters.custom_token_bans;
    if (Array.isArray(customTokenBans) && customTokenBans.every((value) => Number.isInteger(value)))
      body.custom_token_bans = customTokenBans;
    const logitBias = parameters.logitBias ?? parameters.logit_bias;
    if (logitBias && typeof logitBias === "object" && !Array.isArray(logitBias)) body.logit_bias = logitBias;
    const logprobs = parameters.logprobs;
    if (logprobs != null) body.logprobs = logprobs;
    const promptLogprobs = parameters.promptLogprobs ?? parameters.prompt_logprobs;
    if (promptLogprobs != null) body.prompt_logprobs = boolish(promptLogprobs, false);
    const reasoningDeltaField = parameterString(parameters, ["reasoningDeltaField", "reasoning_delta_field"]);
    if (reasoningDeltaField === "reasoning_content") body.reasoning_delta_field = reasoningDeltaField;
    const reasoningContentCompat = parameters.reasoningContentCompat ?? parameters.reasoning_content_compat;
    if (reasoningContentCompat != null) body.reasoning_content_compat = boolish(reasoningContentCompat, false);
  } else if (provider === "openai") {
    const serviceTier = parameterString(parameters, ["serviceTier", "service_tier"]);
    if (serviceTier && isOpenAiServiceTier(serviceTier)) body.service_tier = serviceTier;
  } else if (provider === "mistral") {
    const effort = mistralReasoningEffort(model, parameters);
    if (effort) body.reasoning_effort = effort;
    const safePrompt = parameters.safePrompt ?? parameters.safe_prompt;
    if (safePrompt != null) body.safe_prompt = boolish(safePrompt, false);
    const promptCacheKey = parameterString(parameters, ["promptCacheKey", "prompt_cache_key"]);
    if (promptCacheKey) body.prompt_cache_key = promptCacheKey;
    const promptMode = parameterString(parameters, ["promptMode", "prompt_mode"]);
    if (promptMode === "reasoning") body.prompt_mode = promptMode;
    const parallelToolCalls = parameters.parallelToolCalls ?? parameters.parallel_tool_calls;
    if (parallelToolCalls != null) body.parallel_tool_calls = boolish(parallelToolCalls, true);
    const prediction = parameters.prediction;
    if (prediction != null) body.prediction = prediction;
  }

  applyCustomParameters(body, parameters, {
    stripSampling: !sendSampling,
    stripStop: !sendSampling,
    skipKey:
      provider === "mistral"
        ? isMistralUnsupportedCustomParameterKey
        : provider === "xai"
          ? (key) => isXAiUnsupportedCustomParameterKey(key, model, xaiReasoningActive)
          : undefined,
  });
  const openrouter = parameters.openrouter ?? parameters.openRouter;
  if (openrouter != null) body.provider = openrouter;
  const toolChoice = parameters.toolChoice ?? parameters.tool_choice;
  if (toolChoice != null) body.tool_choice = toolChoice;
  return body;
}

function visibleGoogleParameters(connection: JsonRecord, parameters: JsonRecord): Record<string, unknown> {
  const model = readString(connection.model);
  const gemini3 = isGemini3Model(model);
  const body: Record<string, unknown> = {};
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: requestMaxTokens(connection, parameters),
  };
  if (!gemini3) {
    generationConfig.temperature = parameterNumber(parameters, ["temperature"]) ?? 0.7;
    const topP = parameterNumber(parameters, ["topP", "top_p"]);
    if (topP !== null) generationConfig.topP = topP;
    const topK = parameterInteger(parameters, ["topK", "top_k"]);
    if (topK !== null && topK > 0) generationConfig.topK = topK;
  }
  const frequencyPenalty = parameterNumber(parameters, ["frequencyPenalty", "frequency_penalty"]);
  if (frequencyPenalty !== null) generationConfig.frequencyPenalty = frequencyPenalty;
  const presencePenalty = parameterNumber(parameters, ["presencePenalty", "presence_penalty"]);
  if (presencePenalty !== null) generationConfig.presencePenalty = presencePenalty;
  const thinkingConfig = googleThinkingConfig(model, parameters);
  if (thinkingConfig) generationConfig.thinkingConfig = thinkingConfig;
  const stop = stopSequences(parameters);
  if (stop) generationConfig.stopSequences = stop;
  const custom = parseRecord(parameters.customParameters ?? parameters.custom_params);
  const customGenerationConfig = parseRecord(custom.generationConfig);
  for (const [key, value] of Object.entries(customGenerationConfig)) {
    if (isReservedCustomParameterKey(key)) continue;
    if (gemini3 && isGoogleGemini3UnsupportedGenerationConfigKey(key)) continue;
    if (generationConfig[key] == null) generationConfig[key] = value;
  }
  for (const [key, value] of Object.entries(custom)) {
    if (key === "generationConfig" || isReservedCustomParameterKey(key)) continue;
    if (isGoogleGenerationConfigCustomParameterKey(key)) {
      if (gemini3 && isGoogleGemini3UnsupportedGenerationConfigKey(key)) continue;
      if (generationConfig[key] == null) generationConfig[key] = value;
      continue;
    }
    if (body[key] == null) body[key] = value;
  }
  body.generationConfig = generationConfig;
  return body;
}

export function providerVisibleLlmParameters(
  connection: JsonRecord,
  parameters: Record<string, unknown>,
  options: { stream?: boolean; hasTools?: boolean } = {},
): Record<string, unknown> {
  const normalizedParameters = parseRecord(parameters);
  const provider = readString(connection.provider).trim();

  if (provider === "anthropic") return visibleAnthropicParameters(connection, normalizedParameters, options);
  if (provider === "google" || provider === "google_vertex")
    return visibleGoogleParameters(connection, normalizedParameters);
  if (provider === "cohere") return visibleCohereParameters(connection, normalizedParameters, options);
  if (["openai", "openai_chatgpt", "openrouter", "xai", "mistral", "nanogpt"].includes(provider)) {
    return visibleOpenAiCompatibleParameters(connection, normalizedParameters, options);
  }

  const visible: Record<string, unknown> = { ...normalizedParameters };
  const capped = requestMaxTokens(connection, normalizedParameters, 0);
  if (capped > 0) visible.maxTokens = capped;
  delete visible._marinara;
  return visible;
}

function nestedGenerationConfig(parameters: JsonRecord): JsonRecord {
  return parseRecord(parameters.generationConfig);
}

function nestedRecord(parameters: JsonRecord, key: string): JsonRecord {
  return parseRecord(parameters[key]);
}

function visibleNumber(parameters: JsonRecord, keys: string[]): number | null {
  const generationConfig = nestedGenerationConfig(parameters);
  return parameterNumber(parameters, keys) ?? parameterNumber(generationConfig, keys);
}

function visibleString(parameters: JsonRecord, keys: string[]): string | null {
  const generationConfig = nestedGenerationConfig(parameters);
  return parameterString(parameters, keys) ?? parameterString(generationConfig, keys);
}

export function generationInfoFromVisibleParameters(
  connection: JsonRecord,
  parameters: Record<string, unknown>,
): GenerationPromptSnapshotInfo {
  const visible = parseRecord(parameters);
  const thinking = nestedRecord(visible, "thinking");
  const outputConfig = nestedRecord(visible, "output_config");
  const reasoning = nestedRecord(visible, "reasoning");
  const text = nestedRecord(visible, "text");
  const thinkingConfig = nestedRecord(nestedGenerationConfig(visible), "thinkingConfig");
  const showThoughts =
    thinking.display === "summarized" ||
    boolish(thinkingConfig.includeThoughts, false) ||
    boolish(visible.showThoughts, false);

  return {
    model: readString(connection.model) || undefined,
    provider: readString(connection.provider) || undefined,
    temperature: visibleNumber(visible, ["temperature"]),
    maxTokens: visibleNumber(visible, ["maxTokens", "max_tokens", "maxOutputTokens", "max_output_tokens"]),
    topP: visibleNumber(visible, ["topP", "top_p"]),
    topK: visibleNumber(visible, ["topK", "top_k"]),
    frequencyPenalty: visibleNumber(visible, ["frequencyPenalty", "frequency_penalty"]),
    presencePenalty: visibleNumber(visible, ["presencePenalty", "presence_penalty"]),
    showThoughts,
    reasoningEffort:
      parameterString(outputConfig, ["effort"]) ??
      parameterString(reasoning, ["effort"]) ??
      parameterString(thinkingConfig, ["thinkingLevel"]) ??
      visibleString(visible, ["reasoningEffort", "reasoning_effort"]),
    verbosity: parameterString(text, ["verbosity"]) ?? visibleString(visible, ["verbosity"]),
    serviceTier: visibleString(visible, ["serviceTier", "service_tier"]),
    assistantPrefill: visibleString(visible, ["assistantPrefill"]),
    tokensPrompt: null,
    tokensCompletion: null,
    tokensCachedPrompt: null,
    tokensCacheWritePrompt: null,
    durationMs: null,
    finishReason: null,
  };
}
