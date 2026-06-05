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

function shouldSendTopK(provider: string): boolean {
  return !["openai", "openrouter", "xai", "mistral", "cohere", "nanogpt"].includes(provider);
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

function isOpenrouterClaudeReasoningModel(provider: string, model: string): boolean {
  if (provider !== "openrouter") return false;
  const normalized = model.toLowerCase();
  return (
    normalized.includes("claude-3.7") ||
    normalized.includes("claude-3-7") ||
    normalized.includes("claude-opus-4") ||
    normalized.includes("claude-sonnet-4") ||
    normalized.includes("claude-haiku-4")
  );
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

function isAnthropicServiceTier(value: string): boolean {
  return ["auto", "standard_only"].includes(value);
}

function visibleOpenAiCompatibleParameters(
  connection: JsonRecord,
  parameters: JsonRecord,
  options: { stream?: boolean },
): Record<string, unknown> {
  const provider = readString(connection.provider).trim();
  const model = readString(connection.model);
  if (shouldUseOpenAiResponses(provider, model)) {
    return visibleOpenAiResponsesParameters(connection, parameters, options);
  }

  const sendSampling = shouldSendOpenAiSamplingParameters(model);
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
    if (topK !== null && topK > 0 && shouldSendTopK(provider)) body.top_k = topK;
    const frequencyPenalty = parameterNumber(parameters, ["frequencyPenalty", "frequency_penalty"]);
    if (frequencyPenalty !== null) body.frequency_penalty = frequencyPenalty;
    const presencePenalty = parameterNumber(parameters, ["presencePenalty", "presence_penalty"]);
    if (presencePenalty !== null) body.presence_penalty = presencePenalty;
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
    if (stop) body.stop = stop;
  }
  const responseFormat = parameterString(parameters, ["responseFormat", "response_format"]);
  if (responseFormat) body.response_format = { type: responseFormat };

  if (provider === "openrouter") {
    if (isOpenrouterClaudeReasoningModel(provider, model)) {
      const effort = openAiReasoningEffort(model, parameters);
      if (effort) body.reasoning = { effort };
    }
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
    skipKey: provider === "mistral" ? isMistralUnsupportedCustomParameterKey : undefined,
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
  options: { stream?: boolean } = {},
): Record<string, unknown> {
  const normalizedParameters = parseRecord(parameters);
  const provider = readString(connection.provider).trim();

  if (provider === "anthropic") return visibleAnthropicParameters(connection, normalizedParameters, options);
  if (provider === "google" || provider === "google_vertex")
    return visibleGoogleParameters(connection, normalizedParameters);
  if (["openai", "openai_chatgpt", "openrouter", "xai", "mistral", "cohere", "nanogpt"].includes(provider)) {
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
