import {
  isClaudeAdaptiveOnlyNoSamplingModel,
  isOpenAIGpt56Model,
  isOpenAIGpt6AlwaysReasoningModel,
  isOpenAIGpt6Model,
  isXaiAutoReasoningModel,
  isXaiConfigurableReasoningModel,
  resolveProviderReasoningEffort,
  shouldSuppressUnknownModelParameters,
} from "./model-lists.js";

/**
 * Which chat generation settings actually change the request for a connection, and what the provider calls each
 * choice.
 *
 * The rules mirror the request builders: provider-generation-runtime.ts (route-level clearing) and each provider
 * implementation. They were derived by sending every setting through the real provider code to a local stub, one
 * change at a time, and keeping only the settings that changed the request. The regression
 * `generation-parameter-relevance` repeats that comparison, so a provider change that makes a hidden setting matter
 * fails the focused regression instead of silently hiding a working control.
 *
 * Live model data (effort levels, verbosity support, OpenRouter's per-model parameter list) only ever narrows the
 * result: a control the request builder would not send stays hidden even if the provider says the model accepts it.
 * Provider ids not listed here are sent through the generic OpenAI-compatible path, so they get its rules and keep
 * nearly every control.
 */

export type GenerationParameterKey =
  | "temperature"
  | "maxTokens"
  | "topP"
  | "topK"
  | "frequencyPenalty"
  | "presencePenalty"
  | "reasoningEffort"
  | "verbosity"
  | "serviceTier"
  | "assistantPrefill"
  | "assistantReasoningPrefill"
  | "customThinkingTags"
  | "customParameters";

export type StoredEffortLevel = "low" | "medium" | "high" | "xhigh" | "maximum";
export type StoredVerbosityLevel = "low" | "medium" | "high";

/** What a model accepts, as reported live by its provider. Every field is optional: absent means not reported. */
export interface ModelParameterCapabilities {
  /** Effort levels the model accepts, in Marinara's stored names. */
  effortLevels?: StoredEffortLevel[];
  /** The provider's own name for each accepted level, shown as reported. */
  effortLabels?: Partial<Record<StoredEffortLevel, string>>;
  /** The provider's own description of each level, when it gives one. */
  effortDescriptions?: Partial<Record<StoredEffortLevel, string>>;
  /** The level the provider uses when none is sent. */
  defaultEffort?: string;
  adaptiveThinking?: boolean;
  fastMode?: boolean;
  /** Temperature, top-p and top-k are rejected by this model family. */
  samplingRejected?: boolean;
  /** Whether the model accepts a verbosity setting, and the provider's default, when the provider reports it. */
  verbosity?: { supported: boolean; default?: string };
  /** The exact settings the provider lists for this model (OpenRouter). Settings missing from it are ignored upstream. */
  supportedParameters?: GenerationParameterKey[];
}

export interface GenerationParameterContext {
  provider?: string | null;
  model?: string | null;
  capabilities?: ModelParameterCapabilities | null;
  /** The current effort choice. Some models only take temperature while reasoning is off; null means Off. */
  reasoningEffort?: StoredEffortLevel | null;
  /** The connection's base URL, for endpoints whose rules depend on the host (native GLM). */
  baseUrl?: string | null;
}

export interface GenerationParameterChoice<T> {
  value: T;
  /** The provider's name for the choice; null for the "off" or "none" choice, which the UI names itself. */
  label: string | null;
  description?: string;
  /** The provider's default level: on the null choice it names the level used when nothing is sent. */
  providerDefault?: string;
  /** This choice is the level the provider uses when nothing is sent. */
  isProviderDefault?: boolean;
  /** For the null choice: "default" when it leaves the provider's default level in place rather than turning reasoning off. */
  kind?: "off" | "default";
}

const ALL: GenerationParameterKey[] = [
  "temperature",
  "maxTokens",
  "topP",
  "topK",
  "frequencyPenalty",
  "presencePenalty",
  "reasoningEffort",
  "verbosity",
  "serviceTier",
  "assistantPrefill",
  "assistantReasoningPrefill",
  "customThinkingTags",
  "customParameters",
];

const SAMPLING: GenerationParameterKey[] = ["temperature", "topP", "topK", "frequencyPenalty", "presencePenalty"];

/** Ids sent through OpenAIProvider under their own provider kind (provider-registry.ts). */
const OPENAI_COMPATIBLE = new Set(["openai", "openrouter", "nanogpt", "xai", "mistral", "cohere", "arli"]);
const KNOWN_PROVIDERS = new Set([
  ...OPENAI_COMPATIBLE,
  "custom",
  "openai_chatgpt",
  "anthropic",
  "claude_subscription",
  "grok_subscription",
  "google",
  "google_vertex",
  "local_sidecar",
]);

/** Settings a provider never sends, whatever the model. */
const NEVER_SENT: Record<string, GenerationParameterKey[]> = {
  // The Agent SDK request carries only model, thinking, effort, fast mode and whitelisted custom keys. Max tokens only
  // sizes the history trim; it does not limit the reply.
  claude_subscription: [
    "temperature",
    "maxTokens",
    "topP",
    "topK",
    "frequencyPenalty",
    "presencePenalty",
    "verbosity",
    "serviceTier",
    "assistantReasoningPrefill",
  ],
  anthropic: ["topP", "frequencyPenalty", "presencePenalty", "verbosity", "serviceTier", "assistantReasoningPrefill"],
  // The ChatGPT (Codex) Responses wrapper sends only the reasoning effort from the generation settings.
  openai_chatgpt: [
    "temperature",
    "maxTokens",
    "topP",
    "topK",
    "frequencyPenalty",
    "presencePenalty",
    "serviceTier",
    "verbosity",
    "assistantReasoningPrefill",
    "customParameters",
  ],
  // The Grok CLI takes the prompt only.
  grok_subscription: [
    "temperature",
    "maxTokens",
    "topP",
    "topK",
    "frequencyPenalty",
    "presencePenalty",
    "reasoningEffort",
    "verbosity",
    "serviceTier",
    "assistantReasoningPrefill",
    "customParameters",
  ],
  google: ["verbosity", "serviceTier", "assistantReasoningPrefill"],
  google_vertex: ["verbosity", "serviceTier", "assistantReasoningPrefill"],
  local_sidecar: ["verbosity", "serviceTier", "assistantReasoningPrefill"],
  xai: ["topK", "serviceTier"],
  openai: ["topK", "serviceTier"],
  openrouter: ["topK"],
  nanogpt: ["topK"],
  mistral: ["topK", "serviceTier"],
  cohere: ["topK", "serviceTier"],
  arli: ["topK", "serviceTier"],
  custom: ["serviceTier"],
};

const RESPONSES_ONLY_PREFIXES = ["gpt-5.6", "gpt-5.5", "gpt-5.4", "codex-"];
const RESPONSES_ONLY_SUFFIXES = ["-codex", "-codex-max", "-codex-mini"];
const XAI_MULTI_AGENT_MODEL = "grok-4.20-multi-agent";

function isOpenAIReasoningModel(model: string): boolean {
  return /^(o1|o3|o4)/.test(model) || model.startsWith("gpt-5") || isOpenAIGpt6Model(model);
}

function isNativeGlmHost(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return false;
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return (
      host === "api.z.ai" ||
      host.endsWith(".api.z.ai") ||
      host === "open.bigmodel.cn" ||
      host.endsWith(".open.bigmodel.cn")
    );
  } catch {
    return false;
  }
}

function hasActiveEffort(effort: StoredEffortLevel | null | undefined): boolean {
  // Unknown counts as active: every stored default is an active level.
  return effort !== null;
}

/** Anthropic models where "off" really turns thinking off (anthropic.provider.ts supportsAnthropicThinkingDisable). */
export function supportsClaudeThinkingDisable(model: string): boolean {
  return /claude-(?:opus|sonnet)-5(?:$|[-.])/u.test(model.toLowerCase());
}

/** The settings worth showing for this provider, model, current effort and live capabilities. */
export function relevantGenerationParameters(context: GenerationParameterContext): Set<GenerationParameterKey> {
  const rawProvider = String(context.provider ?? "").trim();
  if (!rawProvider) return new Set(ALL.filter((key) => key !== "serviceTier"));
  const provider = KNOWN_PROVIDERS.has(rawProvider) ? rawProvider : "custom";
  const model = String(context.model ?? "")
    .trim()
    .toLowerCase();
  const caps = context.capabilities ?? null;
  const effortActive = hasActiveEffort(context.reasoningEffort);
  const hidden = new Set<GenerationParameterKey>(NEVER_SENT[provider] ?? []);
  const hide = (...keys: GenerationParameterKey[]) => keys.forEach((key) => hidden.add(key));

  if (model) {
    // Providers with a built-in catalog send only max tokens and custom parameters for a model they do not know.
    // OpenRouter still sends effort for unknown models.
    if (shouldSuppressUnknownModelParameters(provider, model)) {
      hide(...SAMPLING);
      if (provider !== "openrouter") hide("reasoningEffort");
      hide("verbosity");
    }

    // The generation route clears sampling for Claude model ids on every provider.
    if (isClaudeAdaptiveOnlyNoSamplingModel(model)) hide(...SAMPLING);
    else if (/claude-(opus|sonnet)-4-[56]/.test(model) || /claude-(opus|sonnet)-4\.[56]/.test(model)) {
      hide("topP", "topK", "frequencyPenalty", "presencePenalty");
    }

    // Claude thinking rejects temperature and top_k, so the request drops both (anthropic.provider.ts).
    if (provider === "anthropic" && effortActive) hide("temperature", "topK");

    if (provider === "openai_chatgpt" && !isOpenAIReasoningModel(model)) hide("reasoningEffort");

    if (provider === "google" || provider === "google_vertex") {
      if (!/gemini-3/.test(model) && !/gemini-2\.5|gemini-2\.0-flash-thinking/.test(model)) hide("reasoningEffort");
    }

    if (provider === "custom") {
      // Custom endpoints keep sampling unless the model is GPT-5.5 or 5.6, which reject it.
      if (model.startsWith("gpt-5.5") || isOpenAIGpt56Model(model)) hide(...SAMPLING);
    }

    if (OPENAI_COMPATIBLE.has(provider)) {
      if (!model.startsWith("gpt-5") && !isOpenAIGpt6Model(model)) hide("verbosity");

      // GPT-6 samples only with effort "none"; Astra and 6.1 Sol cannot turn reasoning off.
      const noSampling =
        /^(o1|o3|o4)/.test(model) ||
        isOpenAIGpt56Model(model) ||
        model.startsWith("gpt-5.5") ||
        isOpenAIGpt6AlwaysReasoningModel(model) ||
        ((model.startsWith("gpt-5") || isOpenAIGpt6Model(model)) && effortActive);
      if (noSampling) hide("temperature", "topP", "frequencyPenalty", "presencePenalty");

      // Responses API models never carry penalties. GPT-6 uses it everywhere but OpenRouter.
      if (
        RESPONSES_ONLY_PREFIXES.some((prefix) => model.startsWith(prefix)) ||
        RESPONSES_ONLY_SUFFIXES.some((suffix) => model.endsWith(suffix)) ||
        (isOpenAIGpt6Model(model) && provider !== "openrouter")
      ) {
        hide("frequencyPenalty", "presencePenalty");
      }

      if (model === XAI_MULTI_AGENT_MODEL) hide("maxTokens");

      if (provider === "openrouter") {
        // Grok on OpenRouter reasons automatically and rejects penalties.
        if (model.startsWith("x-ai/grok-")) hide("reasoningEffort", "frequencyPenalty", "presencePenalty");
      } else if (provider === "xai") {
        const xaiReasoningModel =
          model.startsWith("x-ai/grok-") ||
          isXaiConfigurableReasoningModel(model) ||
          isXaiAutoReasoningModel(model) ||
          model === XAI_MULTI_AGENT_MODEL;
        if (xaiReasoningModel) hide("frequencyPenalty", "presencePenalty");
        if (!isXaiConfigurableReasoningModel(model) && model !== XAI_MULTI_AGENT_MODEL) hide("reasoningEffort");
      } else {
        const glm = model.includes("glm") && (provider === "nanogpt" || isNativeGlmHost(context.baseUrl));
        if (provider !== "nanogpt" && !isOpenAIReasoningModel(model) && !glm) hide("reasoningEffort");
      }
    }
  }

  if (caps?.samplingRejected) hide("temperature", "topP", "topK");
  if (caps?.effortLevels && caps.effortLevels.length === 0) hide("reasoningEffort");
  if (caps?.verbosity && !caps.verbosity.supported) hide("verbosity");
  if (caps?.supportedParameters && caps.supportedParameters.length > 0) {
    const listed = new Set(caps.supportedParameters);
    for (const key of [...SAMPLING, "maxTokens", "reasoningEffort", "verbosity"] as GenerationParameterKey[]) {
      if (!listed.has(key)) hide(key);
    }
  }

  return new Set(ALL.filter((key) => !hidden.has(key)));
}

const STORED_EFFORT_LEVELS: StoredEffortLevel[] = ["low", "medium", "high", "xhigh", "maximum"];

/**
 * The effort buttons to offer, named the way the provider names them.
 *
 * With a live catalog the levels and names are the provider's own. Otherwise each stored level is named by the value
 * actually sent for this model, and levels that send the same value are shown once (keeping the one currently
 * selected), so a model without an extra-high level does not show three buttons that all send "high".
 */
export function reasoningEffortChoices(
  context: GenerationParameterContext & { selected?: StoredEffortLevel | null },
): Array<GenerationParameterChoice<StoredEffortLevel | null>> {
  const provider = String(context.provider ?? "").trim();
  const model = String(context.model ?? "")
    .trim()
    .toLowerCase();
  const caps = context.capabilities ?? null;
  // ChatGPT (Codex) has no off level; sending nothing keeps the model's own default.
  const off: GenerationParameterChoice<null> =
    provider === "openai_chatgpt"
      ? {
          value: null,
          label: null,
          kind: "default",
          ...(caps?.defaultEffort
            ? { description: `Provider default: ${caps.defaultEffort}`, providerDefault: caps.defaultEffort }
            : {}),
        }
      : { value: null, label: null };

  if (caps?.effortLevels && caps.effortLevels.length > 0) {
    const levels = caps.effortLevels.map((level) => ({
      value: level,
      label: caps.effortLabels?.[level] ?? level,
      ...(caps.effortDescriptions?.[level] ? { description: caps.effortDescriptions[level] } : {}),
    }));
    if (provider === "openai_chatgpt") return [off, ...levels];
    // Adaptive-only Claude models keep thinking on; "off" only works where the model can disable it.
    const offWorks = !caps.adaptiveThinking || supportsClaudeThinkingDisable(model);
    return offWorks ? [off, ...levels] : levels;
  }

  if (!provider) {
    return [off, ...STORED_EFFORT_LEVELS.map((level) => ({ value: level, label: level }))];
  }

  const groups = new Map<string, StoredEffortLevel[]>();
  for (const level of STORED_EFFORT_LEVELS) {
    const sent = resolveProviderReasoningEffort({ provider, model, reasoningEffort: level }) ?? level;
    const group = groups.get(sent) ?? [];
    group.push(level);
    groups.set(sent, group);
  }
  const choices: Array<GenerationParameterChoice<StoredEffortLevel | null>> = [off];
  for (const [sent, levels] of groups) {
    const keep = context.selected && levels.includes(context.selected) ? context.selected : levels[0]!;
    choices.push({ value: keep, label: sent });
  }
  return choices;
}

const VERBOSITY_LEVELS: StoredVerbosityLevel[] = ["low", "medium", "high"];

/** The verbosity buttons to offer, named with the provider's API values; the provider's default is described. */
export function verbosityChoices(
  context: GenerationParameterContext,
): Array<GenerationParameterChoice<StoredVerbosityLevel | null>> {
  const providerDefault = context.capabilities?.verbosity?.default;
  return [
    {
      value: null,
      label: null,
      ...(providerDefault ? { description: `Provider default: ${providerDefault}`, providerDefault } : {}),
    },
    ...VERBOSITY_LEVELS.map((level) => ({
      value: level,
      label: level,
      ...(providerDefault === level ? { description: "Provider default", isProviderDefault: true } : {}),
    })),
  ];
}
