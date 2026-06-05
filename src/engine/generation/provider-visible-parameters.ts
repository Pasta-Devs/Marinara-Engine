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

function supportsAnthropicAdaptiveThinking(model: string): boolean {
  return claudeVersionAtLeast(model, "opus", 4, 6) || claudeVersionAtLeast(model, "sonnet", 4, 6);
}

function shouldSendOpenAiSamplingParameters(model: string): boolean {
  return !isClaudeOpusAdaptiveOnlyModel(model);
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

function supportsOpenAiXhighReasoningModel(model: string): boolean {
  const id = openAiModelId(model);
  if (id === "gpt-5-pro" || id.startsWith("gpt-5-pro-")) return false;
  if (id === "gpt-5.1-codex-max" || id.startsWith("gpt-5.1-codex-max-")) return true;
  const minor = gpt5MinorVersion(id);
  return minor !== null && minor >= 2;
}

function openAiReasoningEffort(model: string, parameters: JsonRecord): string | null {
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"]);
  if (!effort) return null;
  if (["low", "medium", "high"].includes(effort)) return effort;
  if (effort === "maximum" || effort === "xhigh") return supportsOpenAiXhighReasoningModel(model) ? "xhigh" : "high";
  return null;
}

function anthropicThinkingEffort(model: string, parameters: JsonRecord): string | null {
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"]);
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

function isGemini25Model(model: string): boolean {
  const normalized = model.toLowerCase();
  return (
    normalized.startsWith("gemini-2.5") ||
    normalized.startsWith("google/gemini-2.5") ||
    normalized.includes("/gemini-2.5")
  );
}

function googleThinkingLevel(parameters: JsonRecord): string | null {
  const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"]);
  if (!effort) return null;
  if (["low", "medium"].includes(effort)) return effort;
  if (["high", "maximum", "xhigh"].includes(effort)) return "high";
  return null;
}

function googleThinkingConfig(model: string, parameters: JsonRecord): Record<string, unknown> | null {
  if (isGemini3Model(model)) {
    const level = googleThinkingLevel(parameters);
    return level ? { thinkingLevel: level, includeThoughts: true } : null;
  }

  if (isGemini25Model(model)) {
    const effort = parameterString(parameters, ["reasoningEffort", "reasoning_effort"]);
    if (!effort) return null;
    const budget =
      effort === "low"
        ? 1024
        : effort === "medium"
          ? 8192
          : ["high", "maximum", "xhigh"].includes(effort)
            ? 24576
            : null;
    return budget ? { thinkingBudget: budget, includeThoughts: true } : null;
  }

  return null;
}

function applyCustomParameters(
  body: Record<string, unknown>,
  parameters: JsonRecord,
  options: { stripSampling: boolean },
): void {
  const custom = parseRecord(parameters.customParameters ?? parameters.custom_params);
  for (const [key, value] of Object.entries(custom)) {
    if (options.stripSampling && isSamplingParameterKey(key)) continue;
    if (body[key] == null) body[key] = value;
  }
}

function visibleAnthropicParameters(
  connection: JsonRecord,
  parameters: JsonRecord,
  options: { stream?: boolean },
): Record<string, unknown> {
  const model = readString(connection.model);
  const adaptiveOnly = isClaudeOpusAdaptiveOnlyModel(model);
  const effort = anthropicThinkingEffort(model, parameters);
  const adaptiveThinking = shouldUseAnthropicAdaptiveThinking(model, parameters, effort);
  const body: Record<string, unknown> = {
    max_tokens: requestMaxTokens(connection, parameters),
  };
  if (options.stream) body.stream = true;
  if (!adaptiveOnly && !adaptiveThinking) {
    const temperature = parameterNumber(parameters, ["temperature"]);
    if (temperature !== null) body.temperature = temperature;
  }
  if (!adaptiveOnly) {
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
  const stop = stopSequences(parameters);
  if (stop) body.stop_sequences = stop;
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
  const responseFormat = parameterString(parameters, ["responseFormat", "response_format"]);
  const verbosity = parameterString(parameters, ["verbosity"]);
  if (responseFormat === "json_object" || verbosity) {
    const text: Record<string, unknown> = {};
    if (responseFormat === "json_object") text.format = { type: "json_object" };
    if (verbosity) text.verbosity = verbosity;
    body.text = text;
  }
  applyCustomParameters(body, parameters, {
    stripSampling: !shouldSendOpenAiSamplingParameters(readString(connection.model)),
  });
  return body;
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
  if (seed !== null) body.seed = seed;
  const stop = stopSequences(parameters);
  if (stop) body.stop = stop;
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
    if (serviceTier === "flex" || serviceTier === "priority") body.service_tier = serviceTier;
  }

  applyCustomParameters(body, parameters, { stripSampling: !sendSampling });
  const openrouter = parameters.openrouter ?? parameters.openRouter;
  if (openrouter != null) body.provider = openrouter;
  const toolChoice = parameters.toolChoice ?? parameters.tool_choice;
  if (toolChoice != null) body.tool_choice = toolChoice;
  return body;
}

function visibleGoogleParameters(connection: JsonRecord, parameters: JsonRecord): Record<string, unknown> {
  const model = readString(connection.model);
  const gemini3 = isGemini3Model(model);
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
  const thinkingConfig = googleThinkingConfig(model, parameters);
  if (thinkingConfig) generationConfig.thinkingConfig = thinkingConfig;
  if (!gemini3) {
    const stop = stopSequences(parameters);
    if (stop) generationConfig.stopSequences = stop;
  }
  return { generationConfig };
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
