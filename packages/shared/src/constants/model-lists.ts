// ──────────────────────────────────────────────────────────────
// Known Model Lists per Provider
// Copied from SillyTavern release branch (public/index.html)
// https://github.com/SillyTavern/SillyTavern/blob/release/public/index.html
// ──────────────────────────────────────────────────────────────
import type { APIProvider } from "../types/connection.js";
import { PROVIDERS } from "./providers.js";
import { LOCAL_SIDECAR_CONNECTION_ID } from "./defaults.js";

export interface KnownModel {
  id: string;
  name: string;
  context: number;
  /** Output / max completion tokens (0 = unknown / model default) */
  maxOutput: number;
}

const BRACKET_PAIRS: Record<string, string> = { "[": "]", "【": "】", "(": ")", "（": "）" };

/** Channel tags that new-api/one-api resellers put in front of a model id, such as `[次]`, `[SP]`, `【限时】`. */
function stripTagPrefix(id: string): string {
  let s = id.trimStart();
  for (let close = BRACKET_PAIRS[s[0] ?? ""]; close; close = BRACKET_PAIRS[s[0] ?? ""]) {
    const end = s.indexOf(close);
    if (end < 0) break;
    s = s.slice(end + 1).trimStart();
  }
  return s;
}

/**
 * Modifiers after a model id: CLIProxyAPI `(high)`/`(8192)`, Claude Code `[1m]`, new-api `@thinking:on` and
 * Vertex `@20250805`. No catalog id contains brackets or `@`. Linear scans, because ids are user input.
 */
function stripModifierSuffix(id: string): string {
  let t = id.trimEnd();
  // Proxies add one or two suffixes; the cap keeps a crafted imported id from looping once per character.
  for (let pass = 0; pass < 4; pass++) {
    const open = Object.keys(BRACKET_PAIRS).find((o) => t.endsWith(BRACKET_PAIRS[o]!));
    const start = open ? t.lastIndexOf(open) : -1;
    if (start >= 0) {
      t = t.slice(0, start).trimEnd();
      continue;
    }
    const at = t.lastIndexOf("@");
    if (at < 0 || t.indexOf("/", at) >= 0) break;
    t = t.slice(0, at).trimEnd();
  }
  return t;
}

/**
 * The id that capability checks read: trimmed, lower case, without proxy tags or modifiers.
 * `[次]claude-opus-4-6` and `claude-opus-4-6(high)` are checked as `claude-opus-4-6`. Vendor paths (`anthropic/…`)
 * stay, because OpenRouter rules read them. Never send this id to a provider; the request keeps the configured id.
 */
export function capabilityModelId(model: string): string {
  return stripModifierSuffix(stripTagPrefix(model.trim().toLowerCase()));
}

/**
 * Proxy ids that make the proxy turn thinking on whatever the request says: new-api's `-thinking`,
 * `-thinking-<budget>`, effort tails (`-high`) and `@thinking:<on|budget>`, AiHubMix `-think`, CLIProxyAPI
 * `(<level|budget>)`. Treat them like a thinking request: no sampling and no forced tool choice, which Anthropic and
 * GPT-5 reject while reasoning runs. Thinking settings Marinara sends still apply where the proxy keeps them.
 */
export function impliesProxyThinking(model: string): boolean {
  let raw = model.trim().toLowerCase();
  // The modifier nearest the end that carries a thinking setting decides; plain labels such as `(free)` or `[1m]` are skipped.
  for (let pass = 0; pass < 4; pass++) {
    const closer = raw.trimEnd().slice(-1);
    const open = Object.keys(BRACKET_PAIRS).find((o) => BRACKET_PAIRS[o] === closer);
    const start = open ? raw.trimEnd().lastIndexOf(open) : -1;
    if (start >= 0) {
      const inner = raw
        .trimEnd()
        .slice(start + 1, -1)
        .trim();
      if (open === "(" || open === "（") {
        if (/^(?:minimal|low|medium|high|xhigh|max|auto|[1-9]\d*)$/u.test(inner)) return true;
        if (["none", "off", "0"].includes(inner)) return false;
      }
      raw = raw.slice(0, start);
      continue;
    }
    const at = raw.lastIndexOf("@");
    if (at < 0 || raw.indexOf("/", at) >= 0) break;
    if (raw.startsWith("@thinking:", at)) return !["", "off", "none", "0"].includes(raw.slice(at + 10).trim());
    raw = raw.slice(0, at);
  }
  const id = capabilityModelId(raw);
  return (
    /(?<!-no|-non)-think(?:ing(?:-[1-9]\d*)?)?$/u.test(id) ||
    /^(?:claude-|gpt-5|o[134])\S*-(?:minimal|low|medium|high|xhigh|max)$/u.test(id)
  );
}

const CLAUDE_ADAPTIVE_ONLY_OPUS_RE = /claude-opus-4-(?:[7-9]|\d{2,})/;

/** Native Claude ID and the dotted ID used by OpenRouter/compatible gateways. */
export function isClaudeOpus55Model(model: string): boolean {
  return /(?:^|\/)claude-opus-5[.-]5(?:$|[-:])/u.test(capabilityModelId(model));
}

/** Native Claude ID and the dotted ID used by OpenRouter/compatible gateways. */
export function isClaudeSonnet55Model(model: string): boolean {
  return /(?:^|\/)claude-sonnet-5[.-]5(?:$|[-:])/u.test(capabilityModelId(model));
}

/**
 * Claude models that reject disabled thinking, forced tool choice, assistant prefill and
 * non-default sampling. Sonnet 5.5 can still skip up-front thinking, but only with the native
 * `between_tools` setting, which OpenAI-compatible gateways cannot send.
 * https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5
 */
export function isClaudeStrictRequestModel(model: string): boolean {
  return isClaudeOpus55Model(model) || isClaudeSonnet55Model(model);
}

export function isClaudeAdaptiveOnlyNoSamplingModel(model: string): boolean {
  const normalized = capabilityModelId(model);
  return (
    CLAUDE_ADAPTIVE_ONLY_OPUS_RE.test(normalized) ||
    /claude-(?:opus|sonnet)-5(?:$|[-.])/u.test(normalized) ||
    normalized.includes("claude-fable-5") ||
    normalized.includes("claude-mythos-5")
  );
}

export function supportsXhighReasoningEffort(model: string): boolean {
  const normalized = capabilityModelId(model);
  return (
    isOpenAIGpt6Model(normalized) ||
    normalized.startsWith("gpt-5.6") ||
    normalized.startsWith("gpt-5.5") ||
    normalized.startsWith("gpt-5.4") ||
    /^grok-4\.[67](?:$|-)/.test(normalized.replace(/^x-ai\//, "")) ||
    normalized === "grok-4.20-multi-agent" ||
    isClaudeAdaptiveOnlyNoSamplingModel(normalized)
  );
}

/**
 * GLM 5.2 and GLM 5.3 accept `reasoning_effort: "max"` on Z.AI's native
 * endpoint, so a preset set to Maximum should reach it instead of being
 * lowered to `high` on the way to the provider.
 */
export function isZaiMaxReasoningEffortModel(model: string): boolean {
  return /(?:^|\/)glm-5\.[23](?:$|[-:])/u.test(capabilityModelId(model));
}

/**
 * Native Mistral models whose `reasoning_effort` can be set. They accept only "high" and "none". Other Mistral models
 * (Magistral, older releases) are not listed as taking it, so they get no effort and keep their own behaviour.
 * https://docs.mistral.ai/capabilities/reasoning
 */
export function isMistralAdjustableReasoningModel(model: string): boolean {
  const normalized = capabilityModelId(model);
  return (
    normalized === "mistral-small-latest" ||
    /^mistral-large-4(?:$|[-.])/u.test(normalized) ||
    /^mistral-medium-3[-.]5(?:$|[-.])/u.test(normalized)
  );
}

/** GLM 5.3 on Mistral (`zai-glm-5-3`) always reasons and takes only "low", "high" or "max", never "none". */
export function isMistralGlm53Model(model: string): boolean {
  return /^zai-glm-5-3(?:$|-)/u.test(capabilityModelId(model));
}

export function isOpenAIGpt56Model(model: string): boolean {
  return capabilityModelId(model).startsWith("gpt-5.6");
}

export function isOpenAIGpt6AstraModel(model: string): boolean {
  return /^(?:openai\/)?gpt-6-astra(?:$|[-:])/u.test(capabilityModelId(model));
}

export function isOpenAIGpt6Model(model: string): boolean {
  return /^(?:openai\/)?gpt-6(?:-(?:astra|sol|luna)|\.1-sol)(?:$|[-:])/u.test(capabilityModelId(model));
}

/**
 * GPT-6 models that cannot turn reasoning off. GPT-6 only takes sampling with effort "none",
 * so these never take it at all. https://developers.openai.com/api/docs/models/gpt-6.1-sol
 */
export function isOpenAIGpt6AlwaysReasoningModel(model: string): boolean {
  return isOpenAIGpt6AstraModel(model) || /^(?:openai\/)?gpt-6\.1-sol(?:$|[-:])/u.test(capabilityModelId(model));
}

export function isOpenAIGpt56SolProAlias(model: string): boolean {
  return model.toLowerCase() === "gpt-5.6-sol-pro";
}

export function resolveOpenAIGpt56ModelForRequest(model: string): string {
  return isOpenAIGpt56SolProAlias(model) ? "gpt-5.6-sol" : model;
}

export type StoredReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "maximum" | "max" | null;
export type ProviderReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max" | null;

export function resolveProviderReasoningEffort(args: {
  provider: string;
  model: string;
  reasoningEffort: StoredReasoningEffort | undefined;
}): ProviderReasoningEffort {
  const providerLower = args.provider.toLowerCase();
  // Argon cannot turn thinking off; without a level it thinks at Google's default, medium, so name that level.
  if (
    (!args.reasoningEffort || args.reasoningEffort === "none") &&
    (providerLower === "google" || providerLower === "google_vertex") &&
    isGeminiArgonModel(args.model)
  ) {
    return "medium";
  }
  if (!args.reasoningEffort || args.reasoningEffort === "none") return null;
  const modelLower = capabilityModelId(args.model);

  const xaiUsesAutoReasoning =
    (providerLower === "xai" && isXaiAutoReasoningModel(modelLower)) ||
    (providerLower === "openrouter" && modelLower.startsWith("x-ai/grok-"));
  if (xaiUsesAutoReasoning) return null;
  // Mistral reasoning models have a single level besides "none".
  if (providerLower === "mistral" && isMistralAdjustableReasoningModel(modelLower)) return "high";
  if (providerLower === "mistral" && isMistralGlm53Model(modelLower)) {
    if (args.reasoningEffort === "low") return "low";
    return args.reasoningEffort === "medium" || args.reasoningEffort === "high" ? "high" : "max";
  }

  const isNativeAnthropicAdaptiveOnly =
    (providerLower === "anthropic" || providerLower === "claude_subscription") &&
    isClaudeAdaptiveOnlyNoSamplingModel(modelLower);
  const supportsXhigh = supportsXhighReasoningEffort(modelLower);
  const supportsMax =
    isOpenAIGpt6Model(modelLower) ||
    isOpenAIGpt56Model(modelLower) ||
    isNativeAnthropicAdaptiveOnly ||
    // DeepSeek takes max for every chat model; xhigh is not one of its levels, so maximum maps to max rather than
    // collapsing to high.
    providerLower === "deepseek" ||
    (providerLower === "zai" && isZaiMaxReasoningEffortModel(modelLower));

  if (args.reasoningEffort === "maximum") {
    return supportsMax ? "max" : supportsXhigh ? "xhigh" : "high";
  }
  if (args.reasoningEffort === "max") {
    return supportsMax ? "max" : supportsXhigh ? "xhigh" : "high";
  }
  if (args.reasoningEffort === "xhigh") {
    return supportsXhigh ? "xhigh" : "high";
  }
  // DeepSeek accepts medium for compatibility but serves it as high, so mapping it here keeps the offered levels
  // honest: without this, "Medium" and "High" would be two buttons that send a different value yet behave the same.
  if (providerLower === "deepseek" && args.reasoningEffort === "medium") return "high";
  return args.reasoningEffort;
}

/** Gemini 3 and later set thinking with `thinkingLevel`; Gemini 2.5 and older take `thinkingBudget`. */
export function isGeminiThinkingLevelModel(model: string): boolean {
  return /gemini-(?:[3-9]|[1-9]\d)(?!\d)/u.test(capabilityModelId(model));
}

/**
 * Gemini 4 Argon takes thinking levels low to high only and cannot turn thinking off. Its sampler, penalty and prefill
 * rules are shared with the newer Flash models (isGeminiStrictRequestModel).
 * https://ai.google.dev/gemini-api/docs/models/gemini-4-argon
 * https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-4-argon
 */
export function isGeminiArgonModel(model: string): boolean {
  return /(?:^|\/)gemini-4-argon(?:$|-)/u.test(capabilityModelId(model));
}

/** Any Gemini model id, bare or with a router prefix such as OpenRouter's `google/`. */
export function isGeminiModel(model: string): boolean {
  return /(?:^|\/)gemini-/u.test(capabilityModelId(model));
}

/**
 * Gemini models that ignore temperature, top-p and top-k and reject frequency and presence penalties and a request
 * ending on a model turn (a prefill): Argon, 3.5 Flash-Lite and 3.6 to 3.8 Flash. OpenRouter variants such as
 * `:online` count too.
 * https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.6
 * https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite
 * https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-6-flash (also 3-7, 3-8)
 */
export function isGeminiStrictRequestModel(model: string): boolean {
  return /(?:^|\/)gemini-(?:4-argon|3\.5-flash-lite|3\.[6-8]-flash)(?:$|[-:])/u.test(capabilityModelId(model));
}

export function isXaiConfigurableReasoningModel(model: string): boolean {
  const normalized = capabilityModelId(model).replace(/^x-ai\//, "");
  return /^grok-4\.[3567](?:$|-)/.test(normalized);
}

export function isXaiAutoReasoningModel(model: string): boolean {
  const normalized = capabilityModelId(model).replace(/^x-ai\//, "");
  return normalized.startsWith("grok-4-1-fast");
}

// ── OpenAI (from #model_openai_select) ──

export const OPENAI_MODELS: KnownModel[] = [
  // GPT-5.6
  { id: "gpt-5.6", name: "gpt-5.6 (alias for gpt-5.6-sol)", context: 1050000, maxOutput: 128000 },
  { id: "gpt-5.6-sol", name: "gpt-5.6-sol", context: 1050000, maxOutput: 128000 },
  { id: "gpt-5.6-sol-pro", name: "gpt-5.6-sol-pro (Sol with pro mode)", context: 1050000, maxOutput: 128000 },
  { id: "gpt-5.6-terra", name: "gpt-5.6-terra", context: 1050000, maxOutput: 128000 },
  { id: "gpt-5.6-luna", name: "gpt-5.6-luna", context: 1050000, maxOutput: 128000 },
  // GPT-6
  { id: "gpt-6.1-sol", name: "gpt-6.1-sol", context: 1050000, maxOutput: 128000 },
  { id: "gpt-6-astra", name: "gpt-6-astra", context: 1050000, maxOutput: 128000 },
  { id: "gpt-6-sol", name: "gpt-6-sol", context: 1050000, maxOutput: 128000 },
  { id: "gpt-6-luna", name: "gpt-6-luna", context: 1050000, maxOutput: 128000 },
  // GPT-5.5
  { id: "gpt-5.5", name: "gpt-5.5", context: 1050000, maxOutput: 128000 },
  { id: "gpt-5.5-2026-04-23", name: "gpt-5.5-2026-04-23", context: 1050000, maxOutput: 128000 },
  { id: "gpt-5.5-pro", name: "gpt-5.5-pro", context: 1050000, maxOutput: 128000 },
  // GPT-5.4
  { id: "gpt-5.4", name: "gpt-5.4", context: 1050000, maxOutput: 128000 },
  { id: "gpt-5.4-2026-03-05", name: "gpt-5.4-2026-03-05", context: 1050000, maxOutput: 128000 },
  // GPT-5.4 Pro (Responses API only)
  { id: "gpt-5.4-pro", name: "gpt-5.4-pro", context: 1050000, maxOutput: 128000 },
  { id: "gpt-5.4-pro-2026-03-05", name: "gpt-5.4-pro-2026-03-05", context: 1050000, maxOutput: 128000 },
  // GPT-5.4 smaller variants
  { id: "gpt-5.4-mini", name: "gpt-5.4-mini", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.4-mini-2026-03-17", name: "gpt-5.4-mini-2026-03-17", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.4-nano", name: "gpt-5.4-nano", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.4-nano-2026-03-17", name: "gpt-5.4-nano-2026-03-17", context: 400000, maxOutput: 128000 },
  // GPT-5.2
  { id: "gpt-5.2", name: "gpt-5.2", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.2-2025-12-11", name: "gpt-5.2-2025-12-11", context: 400000, maxOutput: 128000 },
  {
    id: "gpt-5.2-chat-latest",
    name: "gpt-5.2-chat-latest (deprecated Aug 10 2026)",
    context: 128000,
    maxOutput: 16384,
  },
  // GPT-5.1
  { id: "gpt-5.1", name: "gpt-5.1", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.1-2025-11-13", name: "gpt-5.1-2025-11-13", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.1-chat-latest", name: "gpt-5.1-chat-latest", context: 128000, maxOutput: 16384 },
  // GPT-5
  { id: "gpt-5", name: "gpt-5", context: 400000, maxOutput: 128000 },
  { id: "gpt-5-2025-08-07", name: "gpt-5-2025-08-07", context: 400000, maxOutput: 128000 },
  { id: "gpt-5-chat-latest", name: "gpt-5-chat-latest", context: 128000, maxOutput: 16384 },
  { id: "gpt-5-mini", name: "gpt-5-mini", context: 400000, maxOutput: 128000 },
  { id: "gpt-5-mini-2025-08-07", name: "gpt-5-mini-2025-08-07", context: 400000, maxOutput: 128000 },
  { id: "gpt-5-nano", name: "gpt-5-nano", context: 400000, maxOutput: 128000 },
  { id: "gpt-5-nano-2025-08-07", name: "gpt-5-nano-2025-08-07", context: 400000, maxOutput: 128000 },
  // ChatGPT instant model exposed through the OpenAI API
  { id: "chat-latest", name: "chat-latest", context: 400000, maxOutput: 128000 },
  // GPT-4o
  { id: "gpt-4o", name: "gpt-4o", context: 128000, maxOutput: 16384 },
  { id: "gpt-4o-2024-11-20", name: "gpt-4o-2024-11-20", context: 128000, maxOutput: 16384 },
  { id: "gpt-4o-2024-08-06", name: "gpt-4o-2024-08-06", context: 128000, maxOutput: 16384 },
  { id: "gpt-4o-2024-05-13", name: "gpt-4o-2024-05-13", context: 128000, maxOutput: 4096 },
  { id: "chatgpt-4o-latest", name: "chatgpt-4o-latest", context: 128000, maxOutput: 16384 },
  // GPT-4o mini
  { id: "gpt-4o-mini", name: "gpt-4o-mini", context: 128000, maxOutput: 16384 },
  { id: "gpt-4o-mini-2024-07-18", name: "gpt-4o-mini-2024-07-18", context: 128000, maxOutput: 16384 },
  // GPT-4.1
  { id: "gpt-4.1", name: "gpt-4.1", context: 1047576, maxOutput: 32768 },
  { id: "gpt-4.1-2025-04-14", name: "gpt-4.1-2025-04-14", context: 1047576, maxOutput: 32768 },
  { id: "gpt-4.1-mini", name: "gpt-4.1-mini", context: 1047576, maxOutput: 32768 },
  { id: "gpt-4.1-mini-2025-04-14", name: "gpt-4.1-mini-2025-04-14", context: 1047576, maxOutput: 32768 },
  { id: "gpt-4.1-nano", name: "gpt-4.1-nano", context: 1047576, maxOutput: 32768 },
  { id: "gpt-4.1-nano-2025-04-14", name: "gpt-4.1-nano-2025-04-14", context: 1047576, maxOutput: 32768 },
  // o-series reasoning
  { id: "o1", name: "o1", context: 200000, maxOutput: 100000 },
  { id: "o1-2024-12-17", name: "o1-2024-12-17", context: 200000, maxOutput: 100000 },
  { id: "o1-mini", name: "o1-mini", context: 128000, maxOutput: 65536 },
  { id: "o1-mini-2024-09-12", name: "o1-mini-2024-09-12", context: 128000, maxOutput: 65536 },
  { id: "o1-pro", name: "o1-pro", context: 200000, maxOutput: 100000 },
  { id: "o1-pro-2025-03-19", name: "o1-pro-2025-03-19", context: 200000, maxOutput: 100000 },
  { id: "o3", name: "o3", context: 200000, maxOutput: 100000 },
  { id: "o3-2025-04-16", name: "o3-2025-04-16", context: 200000, maxOutput: 100000 },
  { id: "o3-mini", name: "o3-mini", context: 200000, maxOutput: 100000 },
  { id: "o3-mini-2025-01-31", name: "o3-mini-2025-01-31", context: 200000, maxOutput: 100000 },
  { id: "o4-mini", name: "o4-mini", context: 200000, maxOutput: 100000 },
  { id: "o4-mini-2025-04-16", name: "o4-mini-2025-04-16", context: 200000, maxOutput: 100000 },
  // Codex (Responses API only)
  { id: "gpt-5.3-codex", name: "gpt-5.3-codex", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.2-codex", name: "gpt-5.2-codex", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.1-codex", name: "gpt-5.1-codex", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.1-codex-max", name: "gpt-5.1-codex-max", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.1-codex-mini", name: "gpt-5.1-codex-mini", context: 400000, maxOutput: 128000 },
  { id: "gpt-5-codex", name: "gpt-5-codex", context: 400000, maxOutput: 128000 },
  { id: "codex-mini-latest", name: "codex-mini-latest", context: 200000, maxOutput: 100000 },
  // GPT-4.5
  { id: "gpt-4.5-preview", name: "gpt-4.5-preview", context: 128000, maxOutput: 16384 },
  { id: "gpt-4.5-preview-2025-02-27", name: "gpt-4.5-preview-2025-02-27", context: 128000, maxOutput: 16384 },
  // GPT-4 Turbo and GPT-4
  { id: "gpt-4-turbo", name: "gpt-4-turbo", context: 128000, maxOutput: 4096 },
  { id: "gpt-4-turbo-2024-04-09", name: "gpt-4-turbo-2024-04-09", context: 128000, maxOutput: 4096 },
  { id: "gpt-4-turbo-preview", name: "gpt-4-turbo-preview", context: 128000, maxOutput: 4096 },
  { id: "gpt-4-0125-preview", name: "gpt-4-0125-preview (2024)", context: 128000, maxOutput: 4096 },
  { id: "gpt-4-1106-preview", name: "gpt-4-1106-preview (2023)", context: 128000, maxOutput: 4096 },
  { id: "gpt-4", name: "gpt-4", context: 8192, maxOutput: 4096 },
  { id: "gpt-4-0613", name: "gpt-4-0613 (2023)", context: 8192, maxOutput: 4096 },
  { id: "gpt-4-0314", name: "gpt-4-0314 (2023)", context: 8192, maxOutput: 4096 },
  // GPT-3.5 Turbo
  { id: "gpt-3.5-turbo", name: "gpt-3.5-turbo", context: 16385, maxOutput: 4096 },
  { id: "gpt-3.5-turbo-0125", name: "gpt-3.5-turbo-0125 (2024)", context: 16385, maxOutput: 4096 },
  { id: "gpt-3.5-turbo-1106", name: "gpt-3.5-turbo-1106 (2023)", context: 16385, maxOutput: 4096 },
  { id: "gpt-3.5-turbo-instruct", name: "gpt-3.5-turbo-instruct", context: 4096, maxOutput: 4096 },
  // Other
  { id: "babbage-002", name: "babbage-002", context: 16384, maxOutput: 4096 },
  { id: "davinci-002", name: "davinci-002", context: 16384, maxOutput: 4096 },
];

// ── Anthropic / Claude (from #model_claude_select) ──

export const ANTHROPIC_MODELS: KnownModel[] = [
  { id: "claude-opus-5-5", name: "claude-opus-5-5", context: 1000000, maxOutput: 128000 },
  { id: "claude-opus-5", name: "claude-opus-5", context: 1000000, maxOutput: 128000 },
  { id: "claude-sonnet-5-5", name: "claude-sonnet-5-5", context: 1000000, maxOutput: 128000 },
  { id: "claude-sonnet-5", name: "claude-sonnet-5", context: 1000000, maxOutput: 128000 },
  { id: "claude-fable-5-1", name: "claude-fable-5-1", context: 1000000, maxOutput: 128000 },
  { id: "claude-fable-5", name: "claude-fable-5", context: 1000000, maxOutput: 128000 },
  { id: "claude-mythos-5-1", name: "claude-mythos-5-1 (limited access)", context: 1000000, maxOutput: 128000 },
  { id: "claude-mythos-5", name: "claude-mythos-5 (limited access)", context: 1000000, maxOutput: 128000 },
  { id: "claude-opus-4-8", name: "claude-opus-4-8", context: 1000000, maxOutput: 128000 },
  { id: "claude-opus-4-7", name: "claude-opus-4-7", context: 1000000, maxOutput: 128000 },
  { id: "claude-opus-4-6", name: "claude-opus-4-6", context: 1000000, maxOutput: 32000 },
  { id: "claude-sonnet-4-6", name: "claude-sonnet-4-6", context: 1000000, maxOutput: 64000 },
  { id: "claude-opus-4-5", name: "claude-opus-4-5", context: 1000000, maxOutput: 32000 },
  { id: "claude-opus-4-5-20251101", name: "claude-opus-4-5-20251101", context: 1000000, maxOutput: 32000 },
  { id: "claude-sonnet-4-5", name: "claude-sonnet-4-5", context: 1000000, maxOutput: 16000 },
  { id: "claude-sonnet-4-5-20250929", name: "claude-sonnet-4-5-20250929", context: 1000000, maxOutput: 16000 },
  { id: "claude-haiku-4-5", name: "claude-haiku-4-5", context: 200000, maxOutput: 64000 },
  { id: "claude-haiku-4-5-20251001", name: "claude-haiku-4-5-20251001", context: 200000, maxOutput: 64000 },
  { id: "claude-opus-4-1", name: "claude-opus-4-1", context: 200000, maxOutput: 32000 },
  { id: "claude-opus-4-1-20250805", name: "claude-opus-4-1-20250805", context: 200000, maxOutput: 32000 },
  { id: "claude-opus-4-0", name: "claude-opus-4-0", context: 200000, maxOutput: 32000 },
  { id: "claude-opus-4-20250514", name: "claude-opus-4-20250514", context: 200000, maxOutput: 32000 },
  { id: "claude-sonnet-4-0", name: "claude-sonnet-4-0", context: 200000, maxOutput: 64000 },
  { id: "claude-sonnet-4-20250514", name: "claude-sonnet-4-20250514", context: 200000, maxOutput: 64000 },
  { id: "claude-3-7-sonnet-latest", name: "claude-3-7-sonnet-latest", context: 200000, maxOutput: 128000 },
  { id: "claude-3-7-sonnet-20250219", name: "claude-3-7-sonnet-20250219", context: 200000, maxOutput: 128000 },
  { id: "claude-3-5-sonnet-latest", name: "claude-3-5-sonnet-latest", context: 200000, maxOutput: 8192 },
  { id: "claude-3-5-sonnet-20241022", name: "claude-3-5-sonnet-20241022", context: 200000, maxOutput: 8192 },
  { id: "claude-3-5-sonnet-20240620", name: "claude-3-5-sonnet-20240620", context: 200000, maxOutput: 8192 },
  { id: "claude-3-5-haiku-latest", name: "claude-3-5-haiku-latest", context: 200000, maxOutput: 8192 },
  { id: "claude-3-5-haiku-20241022", name: "claude-3-5-haiku-20241022", context: 200000, maxOutput: 8192 },
  { id: "claude-3-opus-20240229", name: "claude-3-opus-20240229", context: 200000, maxOutput: 4096 },
  { id: "claude-3-haiku-20240307", name: "claude-3-haiku-20240307", context: 200000, maxOutput: 4096 },
];

// ── Claude (Subscription via Claude Agent SDK) ──
// Models reachable through the local `claude` CLI auth (Pro / Max). Anthropic
// gates which model IDs are available per plan tier; the SDK surfaces a clear
// error if the signed-in plan can't run the requested model. The model picker
// shows Claude Code's cached catalog for the account; this curated list is the
// fallback before Claude Code has cached one. We keep it to the current tool-eligible
// families to avoid offering retired aliases the subscription path rejects.
export const CLAUDE_SUBSCRIPTION_MODELS: KnownModel[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", context: 1000000, maxOutput: 128000 },
  { id: "claude-opus-5", name: "Claude Opus 5", context: 1000000, maxOutput: 128000 },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", context: 1000000, maxOutput: 128000 },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5", context: 1000000, maxOutput: 128000 },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", context: 1000000, maxOutput: 128000 },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1", context: 1000000, maxOutput: 128000 },
  { id: "claude-fable-5", name: "Claude Fable 5", context: 1000000, maxOutput: 128000 },
  { id: "claude-opus-4-8", name: "Claude Opus 4.8", context: 1000000, maxOutput: 128000 },
  { id: "claude-opus-4-7", name: "Claude Opus 4.7", context: 1000000, maxOutput: 128000 },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", context: 1000000, maxOutput: 32000 },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", context: 1000000, maxOutput: 64000 },
  { id: "claude-opus-4-5", name: "Claude Opus 4.5", context: 1000000, maxOutput: 32000 },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", context: 1000000, maxOutput: 16000 },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", context: 200000, maxOutput: 64000 },
];

// ── OpenAI (ChatGPT login via Codex auth) ──
// The ChatGPT-backed Codex endpoint can return an account-specific model
// catalog when authenticated. This curated fallback keeps the selector useful
// before the user has run `codex login`. GPT-6 and GPT-5.6 contexts are Codex's
// default window from its model catalog (October 2026). GPT-5.5 stays first so
// new connections keep it as their default model.
export const OPENAI_CHATGPT_MODELS: KnownModel[] = [
  { id: "gpt-5.5", name: "GPT-5.5", context: 1050000, maxOutput: 128000 },
  { id: "gpt-6.1-sol", name: "GPT-6.1-Sol", context: 272000, maxOutput: 128000 },
  { id: "gpt-6-astra", name: "GPT-6-Astra", context: 272000, maxOutput: 128000 },
  { id: "gpt-6-sol", name: "GPT-6-Sol", context: 272000, maxOutput: 128000 },
  { id: "gpt-6-luna", name: "GPT-6-Luna", context: 272000, maxOutput: 128000 },
  { id: "gpt-5.6-sol", name: "GPT-5.6-Sol", context: 272000, maxOutput: 128000 },
  { id: "gpt-5.6-terra", name: "GPT-5.6-Terra", context: 272000, maxOutput: 128000 },
  { id: "gpt-5.6-luna", name: "GPT-5.6-Luna", context: 272000, maxOutput: 128000 },
  { id: "gpt-5.4", name: "GPT-5.4", context: 1050000, maxOutput: 128000 },
  { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.3-codex-spark", name: "GPT-5.3 Codex Spark", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.3-codex", name: "GPT-5.3 Codex", context: 400000, maxOutput: 128000 },
  { id: "gpt-5-codex", name: "GPT-5 Codex", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.2", name: "GPT-5.2 (deprecated in Codex ChatGPT sign-in)", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.2-codex", name: "GPT-5.2 Codex", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.1", name: "GPT-5.1", context: 400000, maxOutput: 128000 },
  { id: "gpt-5.1-codex", name: "GPT-5.1 Codex", context: 400000, maxOutput: 128000 },
  { id: "gpt-5", name: "GPT-5", context: 400000, maxOutput: 128000 },
  { id: "gpt-4o", name: "GPT-4o", context: 128000, maxOutput: 16384 },
  { id: "chatgpt-4o-latest", name: "ChatGPT 4o Latest", context: 128000, maxOutput: 16384 },
];

// ── Google AI Studio (from #model_google_select) ──

export const GOOGLE_MODELS: KnownModel[] = [
  // Gemini 3.8. New Google and Vertex connections start on the first entry, so keep a widely available Flash here.
  { id: "gemini-3.8-flash", name: "gemini-3.8-flash", context: 1000000, maxOutput: 65536 },
  // Gemini 4. Argon needs a paid tier and, on Vertex, the global, us or eu location.
  { id: "gemini-4-argon", name: "gemini-4-argon", context: 1000000, maxOutput: 65536 },
  // Gemini 3.7
  { id: "gemini-3.7-flash", name: "gemini-3.7-flash", context: 1000000, maxOutput: 65536 },
  // Gemini 3.6
  { id: "gemini-3.6-flash", name: "gemini-3.6-flash", context: 1000000, maxOutput: 65536 },
  // Gemini 3.5
  { id: "gemini-3.5-flash", name: "gemini-3.5-flash", context: 1000000, maxOutput: 65536 },
  { id: "gemini-3.5-flash-lite", name: "gemini-3.5-flash-lite", context: 1000000, maxOutput: 65536 },
  // Gemini 3.1
  { id: "gemini-3.1-pro-preview", name: "gemini-3.1-pro-preview", context: 1000000, maxOutput: 65536 },
  {
    id: "gemini-3.1-pro-preview-customtools",
    name: "gemini-3.1-pro-preview-customtools",
    context: 1000000,
    maxOutput: 65536,
  },
  { id: "gemini-3.1-pro", name: "gemini-3.1-pro", context: 1000000, maxOutput: 65536 },
  { id: "gemini-3.1-flash-lite", name: "gemini-3.1-flash-lite", context: 1000000, maxOutput: 65536 },
  { id: "gemini-3.1-flash-lite-preview", name: "gemini-3.1-flash-lite-preview", context: 1000000, maxOutput: 65536 },
  { id: "gemini-3.1-flash-image", name: "gemini-3.1-flash-image", context: 131072, maxOutput: 32768 },
  { id: "gemini-3.1-flash-image-preview", name: "gemini-3.1-flash-image-preview", context: 131072, maxOutput: 32768 },
  { id: "gemini-3.1-flash-lite-image", name: "gemini-3.1-flash-lite-image", context: 65536, maxOutput: 4096 },
  // Gemini 3.0
  { id: "gemini-3-pro-preview", name: "gemini-3-pro-preview", context: 1000000, maxOutput: 65536 },
  {
    id: "gemini-3-pro-preview-customtools",
    name: "gemini-3-pro-preview-customtools",
    context: 1000000,
    maxOutput: 65536,
  },
  { id: "gemini-3-flash", name: "gemini-3-flash", context: 1000000, maxOutput: 65536 },
  { id: "gemini-3-pro-image-preview", name: "gemini-3-pro-image-preview", context: 65536, maxOutput: 32768 },
  { id: "gemini-3-pro-image", name: "gemini-3-pro-image", context: 65536, maxOutput: 32768 },
  { id: "gemini-3-flash-preview", name: "gemini-3-flash-preview", context: 1000000, maxOutput: 65536 },
  // Gemini 2.5
  { id: "gemini-2.5-pro", name: "gemini-2.5-pro", context: 1000000, maxOutput: 65536 },
  { id: "gemini-2.5-pro-preview-06-05", name: "gemini-2.5-pro-preview-06-05", context: 1000000, maxOutput: 65536 },
  { id: "gemini-2.5-pro-preview-05-06", name: "gemini-2.5-pro-preview-05-06", context: 1000000, maxOutput: 65536 },
  { id: "gemini-2.5-pro-preview-03-25", name: "gemini-2.5-pro-preview-03-25", context: 1000000, maxOutput: 65536 },
  { id: "gemini-2.5-flash", name: "gemini-2.5-flash", context: 1000000, maxOutput: 65536 },
  {
    id: "gemini-2.5-flash-preview-09-2025",
    name: "gemini-2.5-flash-preview-09-2025",
    context: 1000000,
    maxOutput: 65536,
  },
  { id: "gemini-2.5-flash-preview-05-20", name: "gemini-2.5-flash-preview-05-20", context: 1000000, maxOutput: 65536 },
  { id: "gemini-2.5-flash-lite", name: "gemini-2.5-flash-lite", context: 1000000, maxOutput: 65536 },
  {
    id: "gemini-2.5-flash-lite-preview-09-2025",
    name: "gemini-2.5-flash-lite-preview-09-2025",
    context: 1000000,
    maxOutput: 65536,
  },
  {
    id: "gemini-2.5-flash-lite-preview-06-17",
    name: "gemini-2.5-flash-lite-preview-06-17",
    context: 1000000,
    maxOutput: 65536,
  },
  { id: "gemini-2.5-flash-image", name: "gemini-2.5-flash-image", context: 65536, maxOutput: 32768 },
  { id: "gemini-2.5-flash-image-preview", name: "gemini-2.5-flash-image-preview", context: 65536, maxOutput: 32768 },
  // Gemini 2.0
  {
    id: "gemini-2.0-pro-exp-02-05",
    name: "gemini-2.0-pro-exp-02-05 → 2.5-exp-03-25",
    context: 1000000,
    maxOutput: 8192,
  },
  { id: "gemini-2.0-pro-exp", name: "gemini-2.0-pro-exp → 2.5-exp-03-25", context: 1000000, maxOutput: 8192 },
  { id: "gemini-exp-1206", name: "gemini-exp-1206 → 2.5-exp-03-25", context: 1000000, maxOutput: 8192 },
  { id: "gemini-2.0-flash-001", name: "gemini-2.0-flash-001", context: 1000000, maxOutput: 8192 },
  {
    id: "gemini-2.0-flash-exp-image-generation",
    name: "gemini-2.0-flash-exp-image-generation",
    context: 1000000,
    maxOutput: 8192,
  },
  {
    id: "gemini-2.0-flash-preview-image-generation",
    name: "gemini-2.0-flash-preview-image-generation",
    context: 1000000,
    maxOutput: 8192,
  },
  { id: "gemini-2.0-flash-exp", name: "gemini-2.0-flash-exp", context: 1000000, maxOutput: 8192 },
  { id: "gemini-2.0-flash", name: "gemini-2.0-flash", context: 1000000, maxOutput: 8192 },
  {
    id: "gemini-2.0-flash-thinking-exp-01-21",
    name: "gemini-2.0-flash-thinking-exp-01-21 → 2.5-flash-preview-05-20",
    context: 1000000,
    maxOutput: 65536,
  },
  {
    id: "gemini-2.0-flash-thinking-exp-1219",
    name: "gemini-2.0-flash-thinking-exp-1219 → 2.5-flash-preview-05-20",
    context: 1000000,
    maxOutput: 65536,
  },
  {
    id: "gemini-2.0-flash-thinking-exp",
    name: "gemini-2.0-flash-thinking-exp → 2.5-flash-preview-05-20",
    context: 1000000,
    maxOutput: 65536,
  },
  { id: "gemini-2.0-flash-lite-001", name: "gemini-2.0-flash-lite-001", context: 1000000, maxOutput: 8192 },
  {
    id: "gemini-2.0-flash-lite-preview-02-05",
    name: "gemini-2.0-flash-lite-preview-02-05",
    context: 1000000,
    maxOutput: 8192,
  },
  { id: "gemini-2.0-flash-lite-preview", name: "gemini-2.0-flash-lite-preview", context: 1000000, maxOutput: 8192 },
  { id: "gemini-2.0-flash-lite", name: "gemini-2.0-flash-lite", context: 1000000, maxOutput: 8192 },
  // Gemma
  { id: "gemma-4-31b-it", name: "gemma-4-31b-it", context: 256000, maxOutput: 8192 },
  { id: "gemma-4-26b-a4b-it", name: "gemma-4-26b-a4b-it", context: 256000, maxOutput: 8192 },
  { id: "gemma-4-12b-it", name: "gemma-4-12b-it", context: 256000, maxOutput: 8192 },
  { id: "gemma-4-4b-it", name: "gemma-4-4b-it", context: 131072, maxOutput: 8192 },
  { id: "gemma-3n-e4b-it", name: "gemma-3n-e4b-it", context: 32768, maxOutput: 8192 },
  { id: "gemma-3n-e2b-it", name: "gemma-3n-e2b-it", context: 32768, maxOutput: 8192 },
  { id: "gemma-3-27b-it", name: "gemma-3-27b-it", context: 32768, maxOutput: 8192 },
  { id: "gemma-3-12b-it", name: "gemma-3-12b-it", context: 32768, maxOutput: 8192 },
  { id: "gemma-3-4b-it", name: "gemma-3-4b-it", context: 32768, maxOutput: 8192 },
  { id: "gemma-3-1b-it", name: "gemma-3-1b-it", context: 32768, maxOutput: 8192 },
  // LearnLM
  { id: "learnlm-2.0-flash-experimental", name: "learnlm-2.0-flash-experimental", context: 1000000, maxOutput: 8192 },
  // Robotics-ER
  { id: "gemini-robotics-er-1.5-preview", name: "gemini-robotics-er-1.5-preview", context: 1000000, maxOutput: 8192 },
];

// ── MistralAI (loaded dynamically from API in SillyTavern — no static list) ──

export const MISTRAL_MODELS: KnownModel[] = [];

// ── Cohere (from #model_cohere_select) ──

export const COHERE_MODELS: KnownModel[] = [
  // Command A family
  { id: "command-a-plus-08-2025", name: "command-a-plus-08-2025", context: 128000, maxOutput: 64000 },
  { id: "command-a-reasoning-08-2025", name: "command-a-reasoning-08-2025", context: 256000, maxOutput: 32000 },
  { id: "command-a-translate-08-2025", name: "command-a-translate-08-2025", context: 8192, maxOutput: 8192 },
  { id: "command-a-03-2025", name: "command-a-03-2025", context: 256000, maxOutput: 8192 },
  { id: "command-a-vision-07-2025", name: "command-a-vision-07-2025", context: 128000, maxOutput: 8192 },
  // Stable
  { id: "c4ai-aya-23-8b", name: "c4ai-aya-23-8b", context: 8192, maxOutput: 4096 },
  { id: "c4ai-aya-23", name: "c4ai-aya-23", context: 8192, maxOutput: 4096 },
  { id: "c4ai-aya-expanse-8b", name: "c4ai-aya-expanse-8b", context: 8192, maxOutput: 4096 },
  { id: "c4ai-aya-expanse-32b", name: "c4ai-aya-expanse-32b", context: 128000, maxOutput: 4096 },
  { id: "c4ai-aya-vision-8b", name: "c4ai-aya-vision-8b", context: 8192, maxOutput: 4096 },
  { id: "c4ai-aya-vision-32b", name: "c4ai-aya-vision-32b", context: 128000, maxOutput: 4096 },
  { id: "command-light", name: "command-light", context: 4096, maxOutput: 4096 },
  { id: "command", name: "command", context: 4096, maxOutput: 4096 },
  { id: "command-r", name: "command-r", context: 128000, maxOutput: 4096 },
  { id: "command-r-plus", name: "command-r-plus", context: 128000, maxOutput: 4096 },
  { id: "command-r-08-2024", name: "command-r-08-2024", context: 128000, maxOutput: 4096 },
  { id: "command-r-plus-08-2024", name: "command-r-plus-08-2024", context: 128000, maxOutput: 4096 },
  { id: "command-r7b-12-2024", name: "command-r7b-12-2024", context: 128000, maxOutput: 4096 },
  // Nightly
  { id: "command-light-nightly", name: "command-light-nightly", context: 4096, maxOutput: 4096 },
  { id: "command-nightly", name: "command-nightly", context: 128000, maxOutput: 4096 },
];

// ── OpenRouter (loaded dynamically from API in SillyTavern — no static list) ──

export const OPENROUTER_MODELS: KnownModel[] = [];

// ── xAI / Grok (OpenAI-compatible API) ──

export const XAI_MODELS: KnownModel[] = [
  // https://docs.x.ai/developers/grok-4-7 and /grok-4-6: 500k context,
  // no separate output limit; xhigh reasoning is supported on both models.
  { id: "grok-4.7", name: "Grok 4.7", context: 500000, maxOutput: 0 },
  { id: "grok-4.6", name: "Grok 4.6", context: 500000, maxOutput: 0 },
  { id: "grok-4.5", name: "Grok 4.5", context: 1000000, maxOutput: 0 },
  { id: "grok-4.5-latest", name: "Grok 4.5 Latest", context: 1000000, maxOutput: 0 },
  { id: "grok-4.3", name: "Grok 4.3", context: 1000000, maxOutput: 0 },
  { id: "grok-4.3-latest", name: "Grok 4.3 Latest", context: 1000000, maxOutput: 0 },
  { id: "grok-latest", name: "Grok Latest", context: 1000000, maxOutput: 0 },
  { id: "grok-4-latest", name: "Grok 4 Latest", context: 256000, maxOutput: 0 },
  { id: "grok-4", name: "Grok 4", context: 256000, maxOutput: 0 },
  { id: "grok-4-0709", name: "Grok 4 0709", context: 256000, maxOutput: 0 },
  // Reasoning docs mention this model as auto-reasoning without configurable effort.
  { id: "grok-4-1-fast", name: "Grok 4.1 Fast", context: 2000000, maxOutput: 0 },
  { id: "grok-4-fast-reasoning", name: "Grok 4 Fast Reasoning", context: 2000000, maxOutput: 0 },
  { id: "grok-4-fast-non-reasoning", name: "Grok 4 Fast Non-Reasoning", context: 2000000, maxOutput: 0 },
  { id: "grok-fast-latest", name: "Grok Fast Latest", context: 2000000, maxOutput: 0 },
  // Multi-agent research model; uses Responses API and reasoning.effort for 4 vs 16 agents.
  { id: "grok-4.20-multi-agent", name: "Grok 4.20 Multi-Agent", context: 2000000, maxOutput: 0 },
  // Specialized xAI API models.
  { id: "grok-build-0.1", name: "Grok Build 0.1", context: 256000, maxOutput: 0 },
  { id: "grok-build-latest", name: "Grok Build Latest", context: 256000, maxOutput: 0 },
  { id: "grok-code-fast-1", name: "Grok Code Fast 1", context: 256000, maxOutput: 0 },
  { id: "grok-code-fast-1-0825", name: "Grok Code Fast 1 0825", context: 256000, maxOutput: 0 },
  { id: "grok-code-fast-1-0831", name: "Grok Code Fast 1 0831", context: 256000, maxOutput: 0 },
];

// ── Grok CLI (Subscription via local Grok Build auth) ──
// Account-tier availability is discovered from the installed CLI with
// `grok models`. Keep this empty so Marinara does not hand the CLI stale API
// aliases such as `grok-build-latest` that some Grok CLI installs reject.
export const GROK_SUBSCRIPTION_MODELS: KnownModel[] = [];

// ── Additional providers with static lists in SillyTavern ──

// Groq (from #model_groq_select)
export const GROQ_MODELS: KnownModel[] = [
  { id: "qwen/qwen3-32b", name: "qwen/qwen3-32b", context: 128000, maxOutput: 8192 },
  { id: "deepseek-r1-distill-llama-70b", name: "deepseek-r1-distill-llama-70b", context: 128000, maxOutput: 8192 },
  { id: "gemma2-9b-it", name: "gemma2-9b-it", context: 8191, maxOutput: 8191 },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    name: "meta-llama/llama-4-scout-17b-16e-instruct",
    context: 131072,
    maxOutput: 8192,
  },
  {
    id: "meta-llama/llama-4-maverick-17b-128e-instruct",
    name: "meta-llama/llama-4-maverick-17b-128e-instruct",
    context: 131072,
    maxOutput: 8192,
  },
  { id: "llama-3.1-8b-instant", name: "llama-3.1-8b-instant", context: 131072, maxOutput: 8192 },
  { id: "llama-3.3-70b-versatile", name: "llama-3.3-70b-versatile", context: 128000, maxOutput: 32768 },
  { id: "llama-guard-3-8b", name: "llama-guard-3-8b", context: 8192, maxOutput: 4096 },
  { id: "llama3-70b-8192", name: "llama3-70b-8192", context: 8192, maxOutput: 4096 },
  { id: "llama3-8b-8192", name: "llama3-8b-8192", context: 8192, maxOutput: 4096 },
  { id: "mistral-saba-24b", name: "mistral-saba-24b", context: 32768, maxOutput: 8192 },
];

// DeepSeek (from #model_deepseek_select)
export const DEEPSEEK_MODELS: KnownModel[] = [
  // The current names. `deepseek-v4-flash` is a legacy alias of `deepseek-flash`
  // and still resolves, while deepseek-chat / deepseek-coder / deepseek-reasoner
  // were retired on 2026-07-24.
  { id: "deepseek-flash", name: "deepseek-flash", context: 1_000_000, maxOutput: 384_000 },
  { id: "deepseek-v4-pro", name: "deepseek-v4-pro", context: 1_000_000, maxOutput: 384_000 },
  { id: "deepseek-v4-flash", name: "deepseek-v4-flash (legacy alias)", context: 1_000_000, maxOutput: 384_000 },
];

// Xiaomi MiMo (available through OAI-compatible aggregators and direct APIs)
export const MIMO_MODELS: KnownModel[] = [
  { id: "mimo-v2.5-pro", name: "mimo-v2.5-pro", context: 1_000_000, maxOutput: 128_000 },
];

// Perplexity (from #model_perplexity_select)
export const PERPLEXITY_MODELS: KnownModel[] = [
  // Sonar Models
  { id: "sonar", name: "sonar", context: 128000, maxOutput: 4096 },
  { id: "sonar-pro", name: "sonar-pro", context: 200000, maxOutput: 8192 },
  { id: "sonar-reasoning", name: "sonar-reasoning", context: 128000, maxOutput: 8192 },
  { id: "sonar-reasoning-pro", name: "sonar-reasoning-pro", context: 128000, maxOutput: 8192 },
  { id: "sonar-deep-research", name: "sonar-deep-research", context: 128000, maxOutput: 8192 },
  // Offline Models
  { id: "r1-1776", name: "r1-1776", context: 128000, maxOutput: 8192 },
];

// Moonshot (from #model_moonshot_select)
export const MOONSHOT_MODELS: KnownModel[] = [
  { id: "kimi-k3", name: "kimi-k3", context: 1_048_576, maxOutput: 131_072 },
  { id: "kimi-k2.6", name: "kimi-k2.6", context: 262_144, maxOutput: 32_768 },
  { id: "kimi-k2-0711-preview", name: "kimi-k2-0711-preview", context: 256000, maxOutput: 8192 },
  { id: "moonshot-v1-8k", name: "moonshot-v1-8k", context: 8192, maxOutput: 4096 },
  { id: "moonshot-v1-32k", name: "moonshot-v1-32k", context: 32768, maxOutput: 4096 },
  { id: "moonshot-v1-128k", name: "moonshot-v1-128k", context: 128000, maxOutput: 4096 },
  { id: "moonshot-v1-auto", name: "moonshot-v1-auto", context: 128000, maxOutput: 4096 },
  { id: "kimi-latest", name: "kimi-latest", context: 256000, maxOutput: 8192 },
  { id: "moonshot-v1-8k-vision-preview", name: "moonshot-v1-8k-vision-preview", context: 8192, maxOutput: 4096 },
  { id: "moonshot-v1-32k-vision-preview", name: "moonshot-v1-32k-vision-preview", context: 32768, maxOutput: 4096 },
  { id: "moonshot-v1-128k-vision-preview", name: "moonshot-v1-128k-vision-preview", context: 128000, maxOutput: 4096 },
  { id: "kimi-thinking-preview", name: "kimi-thinking-preview", context: 256000, maxOutput: 8192 },
];

// Z.AI / GLM (from #model_zai_select)
export const ZAI_MODELS: KnownModel[] = [
  { id: "glm-5.3", name: "glm-5.3", context: 1000000, maxOutput: 128000 },
  { id: "glm-5.3-flash", name: "glm-5.3-flash", context: 1000000, maxOutput: 128000 },
  { id: "glm-5.2", name: "glm-5.2", context: 1000000, maxOutput: 128000 },
  { id: "glm-5.1", name: "glm-5.1", context: 200_000, maxOutput: 128_000 },
  { id: "glm-5", name: "glm-5", context: 200000, maxOutput: 128000 },
  { id: "glm-4.7", name: "glm-4.7", context: 200000, maxOutput: 8192 },
  { id: "glm-4.7-flash", name: "glm-4.7-flash", context: 200000, maxOutput: 8192 },
  { id: "glm-4.7-flashx", name: "glm-4.7-flashx", context: 200000, maxOutput: 8192 },
  { id: "glm-4.6", name: "glm-4.6", context: 200000, maxOutput: 8192 },
  { id: "glm-4.6v", name: "glm-4.6v", context: 200000, maxOutput: 8192 },
  { id: "glm-4.6v-flash", name: "glm-4.6v-flash", context: 200000, maxOutput: 8192 },
  { id: "glm-4.6v-flashx", name: "glm-4.6v-flashx", context: 200000, maxOutput: 8192 },
  { id: "glm-4.5v", name: "glm-4.5v", context: 128000, maxOutput: 4096 },
  { id: "glm-4.5", name: "glm-4.5", context: 128000, maxOutput: 4096 },
  { id: "glm-4.5-air", name: "glm-4.5-air", context: 128000, maxOutput: 4096 },
  { id: "glm-4.5-x", name: "glm-4.5-x", context: 128000, maxOutput: 4096 },
  { id: "glm-4.5-airx", name: "glm-4.5-airx", context: 128000, maxOutput: 4096 },
  { id: "glm-4.5-flash", name: "glm-4.5-flash", context: 128000, maxOutput: 4096 },
  { id: "glm-4-32b-0414-128k", name: "glm-4-32b-0414-128k", context: 128000, maxOutput: 4096 },
  { id: "autoglm-phone-multilingual", name: "autoglm-phone-multilingual", context: 128000, maxOutput: 4096 },
];

// AI21 (from #model_ai21_select)
export const AI21_MODELS: KnownModel[] = [
  // Jamba (Latest)
  { id: "jamba-mini", name: "jamba-mini", context: 256000, maxOutput: 4096 },
  { id: "jamba-large", name: "jamba-large", context: 256000, maxOutput: 4096 },
  // Jamba 1.7
  { id: "jamba-1.7-mini", name: "jamba-1.7-mini", context: 256000, maxOutput: 4096 },
  { id: "jamba-1.7-large", name: "jamba-1.7-large", context: 256000, maxOutput: 4096 },
  // Jamba 1.6 (Deprecated)
  { id: "jamba-1.6-mini", name: "jamba-1.6-mini", context: 256000, maxOutput: 4096 },
  { id: "jamba-1.6-large", name: "jamba-1.6-large", context: 256000, maxOutput: 4096 },
  // Jamba 1.5 (Deprecated)
  { id: "jamba-1.5-mini", name: "jamba-1.5-mini", context: 256000, maxOutput: 4096 },
  { id: "jamba-1.5-large", name: "jamba-1.5-large", context: 256000, maxOutput: 4096 },
  // Jamba-Instruct (Deprecated)
  { id: "jamba-instruct-preview", name: "jamba-instruct-preview", context: 256000, maxOutput: 4096 },
];

// ── Image Generation Sources (service metadata for base URLs) ──

export interface ImageGenSource {
  id: string;
  name: string;
  description: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
}

export interface VideoGenSource {
  id: string;
  name: string;
  description: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
}

export const VIDEO_GENERATION_SOURCES: VideoGenSource[] = [
  {
    id: "google_ai_studio",
    name: "Google AI Studio",
    description: "Gemini Omni and Veo video models via the Gemini API.",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    requiresApiKey: true,
  },
  {
    id: "xai",
    name: "xAI Imagine",
    description: "Grok Imagine video and image-to-video via the xAI Videos API.",
    defaultBaseUrl: "https://api.x.ai/v1",
    requiresApiKey: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter Video",
    description: "Video generation models exposed through OpenRouter's asynchronous Videos API.",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
  },
  {
    id: "nanogpt",
    name: "NanoGPT",
    description: "Video generation models discovered from NanoGPT's asynchronous Video API.",
    defaultBaseUrl: "https://nano-gpt.com/api",
    requiresApiKey: true,
  },
  {
    id: "atlas",
    name: "Atlas Cloud",
    description: "Atlas Cloud image and video models through its asynchronous media API.",
    defaultBaseUrl: "https://api.atlascloud.ai/api/v1",
    requiresApiKey: true,
  },
  {
    id: "seedance",
    name: "Seedance 2.0",
    description: "Seedance 2.0 video generation with text, first-frame, and first/last-frame modes.",
    defaultBaseUrl: "https://api.seedance2.ai",
    requiresApiKey: true,
  },
  {
    id: "comfyui",
    name: "ComfyUI",
    description: "Local API-format workflows for WAN and other video models.",
    defaultBaseUrl: "http://127.0.0.1:8188",
    requiresApiKey: false,
  },
  {
    id: "swarmui",
    name: "SwarmUI",
    description: "Swarm-managed video generation through distributed ComfyUI workflows.",
    defaultBaseUrl: "http://127.0.0.1:7801",
    requiresApiKey: false,
  },
];

/** The image model Codex's own image tool uses through a ChatGPT login. */
export const CODEX_IMAGE_MODEL = "gpt-image-2";

/** Image sources that use the same vendor key as the chat provider of the given id (one Connection holds both). */
export const IMAGE_SOURCE_VENDOR: Record<string, string> = {
  openai: "openai",
  openrouter: "openrouter",
  xai: "xai",
  nanogpt: "nanogpt",
  arli: "arli",
  zai: "zai",
  gemini_image: "google",
};

export const IMAGE_GENERATION_SOURCES: ImageGenSource[] = [
  {
    id: "openai",
    name: "OpenAI (DALL-E)",
    description: "DALL-E 2, DALL-E 3, and GPT Image via the OpenAI API.",
    defaultBaseUrl: "https://api.openai.com/v1",
    requiresApiKey: true,
  },
  {
    id: "codex_chatgpt",
    name: "ChatGPT (Codex login)",
    description: "Generate images with your ChatGPT plan instead of API credits.",
    // Saved on the connection so fallbacks and request slots key on the real endpoint. The login
    // token is only ever sent to this fixed URL, never to a stored or edited one.
    defaultBaseUrl: "https://chatgpt.com/backend-api/codex",
    requiresApiKey: false,
  },
  {
    id: "stability",
    name: "Stability AI",
    description: "Stable Diffusion 3, SDXL, and Stable Image via the Stability API.",
    defaultBaseUrl: "https://api.stability.ai/v2beta",
    requiresApiKey: true,
  },
  {
    id: "togetherai",
    name: "Together AI",
    description: "FLUX, Stable Diffusion, and other open-source image models.",
    defaultBaseUrl: "https://api.together.xyz/v1",
    requiresApiKey: true,
  },
  {
    id: "arli",
    name: "Arli AI",
    description: "Hosted Stable Diffusion models through Arli AI's native image API.",
    defaultBaseUrl: "https://api.arliai.com/v1",
    requiresApiKey: true,
  },
  {
    id: "novelai",
    name: "NovelAI",
    description: "NovelAI Diffusion anime-style image generation.",
    defaultBaseUrl: "https://image.novelai.net",
    requiresApiKey: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter Images",
    description: "Image generation models exposed through OpenRouter's chat completions API.",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
  },
  {
    id: "xai",
    name: "xAI / Grok Imagine",
    description: "Grok Imagine image generation via xAI's Images API.",
    defaultBaseUrl: "https://api.x.ai/v1",
    requiresApiKey: true,
  },
  {
    id: "venice",
    name: "Venice.ai",
    description: "Private image generation through Venice's native image API.",
    defaultBaseUrl: "https://api.venice.ai/api/v1",
    requiresApiKey: true,
  },
  {
    id: "zai",
    name: "Z.AI",
    description: "GLM-Image and CogView image generation through Z.AI's native API.",
    defaultBaseUrl: "https://api.z.ai/api/paas/v4",
    requiresApiKey: true,
  },
  {
    id: "atlas",
    name: "Atlas Cloud",
    description: "Image generation across Atlas Cloud's model catalog.",
    defaultBaseUrl: "https://api.atlascloud.ai/api/v1",
    requiresApiKey: true,
  },
  {
    id: "fal",
    name: "fal.ai",
    description: "Text-to-image generation with FLUX and other fal.ai models.",
    defaultBaseUrl: "https://fal.run",
    requiresApiKey: true,
  },
  {
    id: "spicyapi",
    name: "SpicyAPI",
    description: "Uncensored image models from SpicyAPI's catalog.",
    defaultBaseUrl: "https://api.spicyapi.ai/api/v1",
    requiresApiKey: true,
  },
  {
    id: "pollinations",
    name: "Pollinations",
    description: "Free, no-key-needed image generation via Pollinations AI.",
    defaultBaseUrl: "https://image.pollinations.ai",
    requiresApiKey: false,
  },
  {
    id: "horde",
    name: "Stable Horde",
    description: "Crowdsourced distributed image generation. Free with optional API key.",
    defaultBaseUrl: "https://stablehorde.net/api/v2",
    requiresApiKey: false,
  },
  {
    id: "automatic1111",
    name: "SD Web UI (AUTOMATIC1111 / Forge)",
    description: "Local Stable Diffusion via AUTOMATIC1111 or SD.Next WebUI.",
    defaultBaseUrl: "http://localhost:7860",
    requiresApiKey: false,
  },
  {
    id: "comfyui",
    name: "ComfyUI",
    description: "Local node-based image generation with ComfyUI.",
    defaultBaseUrl: "http://127.0.0.1:8188",
    requiresApiKey: false,
  },
  {
    id: "swarmui",
    name: "SwarmUI",
    description: "Swarm-managed image generation and distributed ComfyUI workflows.",
    defaultBaseUrl: "http://127.0.0.1:7801",
    requiresApiKey: false,
  },
  {
    id: "runpod_comfyui",
    name: "RunPod Serverless (ComfyUI)",
    description: "RunPod serverless endpoint running a ComfyUI workflow for text-to-image generation.",
    defaultBaseUrl: "https://api.runpod.ai/v2",
    requiresApiKey: true,
  },
  {
    id: "drawthings",
    name: "Draw Things",
    description: "macOS / iOS local image generation via Draw Things.",
    defaultBaseUrl: "http://localhost:7860",
    requiresApiKey: false,
  },
  {
    id: "nanogpt",
    name: "NanoGPT",
    description: "Image generation via the NanoGPT aggregator.",
    defaultBaseUrl: "https://nano-gpt.com/api/v1",
    requiresApiKey: true,
  },
  {
    id: "blockentropy",
    name: "Block Entropy",
    description: "Decentralised image generation network.",
    defaultBaseUrl: "https://api.blockentropy.ai",
    requiresApiKey: true,
  },
];

// Known image generation models (grouped by service)
export const ATLAS_CLOUD_IMAGE_MODELS: KnownModel[] = [
  { id: "google/nano-banana/text-to-image", name: "Nano Banana (Atlas Cloud)", context: 0, maxOutput: 0 },
  {
    id: "google/gemini-2.5-flash-image/text-to-image",
    name: "Gemini 2.5 Flash Image (Atlas Cloud)",
    context: 0,
    maxOutput: 0,
  },
  { id: "black-forest-labs/flux-1.1-pro", name: "FLUX 1.1 Pro (Atlas Cloud)", context: 0, maxOutput: 0 },
];

export const ZAI_IMAGE_MODELS: KnownModel[] = [
  { id: "glm-image", name: "GLM-Image", context: 0, maxOutput: 0 },
  { id: "cogview-4-250304", name: "CogView 4", context: 0, maxOutput: 0 },
];

export const FAL_IMAGE_MODELS: KnownModel[] = [
  { id: "fal-ai/flux/schnell", name: "FLUX.1 Schnell (fal.ai)", context: 0, maxOutput: 0 },
  { id: "fal-ai/flux/dev", name: "FLUX.1 Dev (fal.ai)", context: 0, maxOutput: 0 },
];

export const SPICYAPI_IMAGE_MODELS: KnownModel[] = [
  { id: "alibaba/z-image-spicy-pro/text-to-image", name: "Z-Image Spicy Pro (SpicyAPI)", context: 0, maxOutput: 0 },
  { id: "bytedance/seedream-5.0-pro/text-to-image", name: "Seedream 5.0 Pro (SpicyAPI)", context: 0, maxOutput: 0 },
  { id: "alibaba/qwen-image-2.1/text-to-image", name: "Qwen Image 2.1 (SpicyAPI)", context: 0, maxOutput: 0 },
];

export const ATLAS_CLOUD_VIDEO_MODELS: KnownModel[] = [
  { id: "google/veo3.1/text-to-video", name: "Veo 3.1 Text to Video (Atlas Cloud)", context: 0, maxOutput: 0 },
  { id: "google/veo3.1/image-to-video", name: "Veo 3.1 Image to Video (Atlas Cloud)", context: 0, maxOutput: 0 },
  {
    id: "bytedance/seedance-2.0-fast/text-to-video",
    name: "Seedance 2.0 Fast Text to Video (Atlas Cloud)",
    context: 0,
    maxOutput: 0,
  },
  {
    id: "bytedance/seedance-2.0-fast/image-to-video",
    name: "Seedance 2.0 Fast Image to Video (Atlas Cloud)",
    context: 0,
    maxOutput: 0,
  },
];

const IMAGE_GEN_MODELS: KnownModel[] = [
  // OpenAI
  { id: "gpt-image-2.5-flare", name: "GPT Image 2.5 Flare", context: 0, maxOutput: 0 },
  { id: "gpt-image-2.5-sunburst", name: "GPT Image 2.5 Sunburst", context: 0, maxOutput: 0 },
  { id: "gpt-image-2", name: "GPT Image 2", context: 0, maxOutput: 0 },
  { id: "gpt-image-1.5", name: "GPT Image 1.5", context: 0, maxOutput: 0 },
  { id: "chatgpt-image-latest", name: "ChatGPT Image Latest", context: 0, maxOutput: 0 },
  { id: "gpt-image-1-mini", name: "GPT Image 1 Mini", context: 0, maxOutput: 0 },
  { id: "dall-e-3", name: "DALL-E 3", context: 0, maxOutput: 0 },
  { id: "dall-e-2", name: "DALL-E 2", context: 0, maxOutput: 0 },
  { id: "gpt-image-1", name: "GPT Image 1", context: 0, maxOutput: 0 },
  // Stability AI
  { id: "stable-image-core", name: "Stable Image Core", context: 0, maxOutput: 0 },
  { id: "stable-image-ultra", name: "Stable Image Ultra", context: 0, maxOutput: 0 },
  { id: "sd3.5-large", name: "Stable Diffusion 3.5 Large", context: 0, maxOutput: 0 },
  { id: "sd3.5-large-turbo", name: "SD3.5 Large Turbo", context: 0, maxOutput: 0 },
  { id: "sd3.5-medium", name: "Stable Diffusion 3.5 Medium", context: 0, maxOutput: 0 },
  { id: "sd3.5-flash", name: "Stable Diffusion 3.5 Flash", context: 0, maxOutput: 0 },
  { id: "sd3-large", name: "Stable Diffusion 3 Large (legacy alias)", context: 0, maxOutput: 0 },
  { id: "sd3-large-turbo", name: "SD3 Large Turbo (legacy alias)", context: 0, maxOutput: 0 },
  { id: "sd3-medium", name: "Stable Diffusion 3 Medium (legacy alias)", context: 0, maxOutput: 0 },
  // Together AI
  { id: "black-forest-labs/FLUX.1-schnell-Free", name: "FLUX.1 Schnell (Free)", context: 0, maxOutput: 0 },
  { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell", context: 0, maxOutput: 0 },
  { id: "black-forest-labs/FLUX.1.1-pro", name: "FLUX 1.1 Pro", context: 0, maxOutput: 0 },
  { id: "stabilityai/stable-diffusion-xl-base-1.0", name: "SDXL Base 1.0", context: 0, maxOutput: 0 },
  // OpenRouter image output models
  { id: "google/gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image (OpenRouter)", context: 0, maxOutput: 0 },
  {
    id: "google/gemini-3.1-flash-image-preview",
    name: "Gemini 3.1 Flash Image Preview (OpenRouter)",
    context: 0,
    maxOutput: 0,
  },
  { id: "black-forest-labs/flux.2-pro", name: "FLUX 2 Pro (OpenRouter)", context: 0, maxOutput: 0 },
  { id: "black-forest-labs/flux.2-flex", name: "FLUX 2 Flex (OpenRouter)", context: 0, maxOutput: 0 },
  {
    id: "sourceful/riverflow-v2-standard-preview",
    name: "RiverFlow V2 Standard Preview (OpenRouter)",
    context: 0,
    maxOutput: 0,
  },
  {
    id: "bytedance-seed/seedream-4.5",
    name: "Seedream 4.5 (OpenRouter)",
    context: 0,
    maxOutput: 0,
  },
  // xAI / Grok Imagine
  { id: "grok-4.1-fast-image", name: "Grok 4.1 Fast Image", context: 0, maxOutput: 0 },
  { id: "grok-imagine-image", name: "Grok Imagine Image", context: 0, maxOutput: 0 },
  { id: "grok-2-image", name: "Grok 2 Image", context: 0, maxOutput: 0 },
  // Venice.ai
  { id: "chroma", name: "Chroma (Venice)", context: 0, maxOutput: 0 },
  { id: "flux-2-pro", name: "FLUX 2 Pro (Venice)", context: 0, maxOutput: 0 },
  { id: "venice-sd35", name: "Venice SD3.5", context: 0, maxOutput: 0 },
  ...ZAI_IMAGE_MODELS,
  ...FAL_IMAGE_MODELS,
  ...SPICYAPI_IMAGE_MODELS,
  ...ATLAS_CLOUD_IMAGE_MODELS,
  // NovelAI
  { id: "nai-diffusion-3", name: "NAI Diffusion 3 (Anime V3)", context: 0, maxOutput: 0 },
  { id: "nai-diffusion-4-curated-preview", name: "NAI Diffusion 4 Curated", context: 0, maxOutput: 0 },
  { id: "nai-diffusion-4-5-curated", name: "NAI Diffusion 4.5 Curated", context: 0, maxOutput: 0 },
  { id: "nai-diffusion-4-5-full", name: "NAI Diffusion 4.5 Full", context: 0, maxOutput: 0 },
  { id: "nai-diffusion-5-curated", name: "NAI Diffusion 5 Curated", context: 0, maxOutput: 0 },
  { id: "nai-diffusion-5-full", name: "NAI Diffusion 5 Full", context: 0, maxOutput: 0 },
  // Pollinations (model-free, but include as placeholder)
  { id: "pollinations", name: "Pollinations (Auto)", context: 0, maxOutput: 0 },
];

const VIDEO_GEN_MODELS: KnownModel[] = [
  { id: "gemini-omni-flash-preview", name: "Gemini Omni Flash Preview", context: 0, maxOutput: 0 },
  { id: "veo-3.1-generate-preview", name: "Veo 3.1 Generate Preview", context: 0, maxOutput: 0 },
  { id: "veo-3.1-fast-generate-preview", name: "Veo 3.1 Fast Generate Preview", context: 0, maxOutput: 0 },
  { id: "veo-3.1-lite-generate-preview", name: "Veo 3.1 Lite Generate Preview", context: 0, maxOutput: 0 },
  { id: "veo-3.0-generate-preview", name: "Veo 3 Generate Preview", context: 0, maxOutput: 0 },
  { id: "veo-3.0-fast-generate-preview", name: "Veo 3 Fast Generate Preview", context: 0, maxOutput: 0 },
  { id: "grok-imagine-video-1.5", name: "Grok Imagine Video 1.5", context: 0, maxOutput: 0 },
  { id: "grok-imagine-video", name: "Grok Imagine Video", context: 0, maxOutput: 0 },
  { id: "google/veo-3.1", name: "Google Veo 3.1 (OpenRouter)", context: 0, maxOutput: 0 },
  { id: "alibaba/wan-2.7", name: "Alibaba WAN 2.7 (OpenRouter)", context: 0, maxOutput: 0 },
  { id: "seedance-2-0", name: "Seedance 2.0", context: 0, maxOutput: 0 },
  { id: "seedance-2-0-fast", name: "Seedance 2.0 Fast", context: 0, maxOutput: 0 },
  ...ATLAS_CLOUD_VIDEO_MODELS,
];

// Seed catalog only — each source's real model/voice lists are fetched at
// runtime through the TTS discovery endpoints (/api/tts/models, /api/tts/voices).
const AUDIO_GEN_MODELS: KnownModel[] = [
  // ElevenLabs
  { id: "eleven_multilingual_v2", name: "Eleven Multilingual v2", context: 0, maxOutput: 0 },
  { id: "eleven_turbo_v2_5", name: "Eleven Turbo v2.5", context: 0, maxOutput: 0 },
  { id: "eleven_flash_v2_5", name: "Eleven Flash v2.5", context: 0, maxOutput: 0 },
  // OpenAI
  { id: "gpt-4o-mini-tts", name: "GPT-4o Mini TTS", context: 0, maxOutput: 0 },
  { id: "tts-1", name: "TTS-1", context: 0, maxOutput: 0 },
  { id: "tts-1-hd", name: "TTS-1 HD", context: 0, maxOutput: 0 },
  // PocketTTS (local)
  { id: "pocket-tts", name: "PocketTTS", context: 0, maxOutput: 0 },
  // xAI
  { id: "grok-tts", name: "Grok TTS", context: 0, maxOutput: 0 },
];

function isProviderHost(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function inferVideoSource(model: string, baseUrl: string): string {
  const m = model.toLowerCase();
  const u = baseUrl.toLowerCase();
  let hostname = "";
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    // Keep inference best-effort for incomplete custom URLs while they are edited.
  }
  if (m === "swarmui" || u.includes(":7801") || u.includes("swarmui")) return "swarmui";
  if (m === "comfyui" || u.includes(":8188") || u.includes("comfyui")) return "comfyui";
  if (m === "atlas" || isProviderHost(hostname, "atlascloud.ai")) return "atlas";
  if (m === "seedance" || m.startsWith("seedance-") || isProviderHost(hostname, "seedance2.ai")) return "seedance";
  if (m === "nanogpt" || isProviderHost(hostname, "nano-gpt.com")) {
    return "nanogpt";
  }
  if (m === "openrouter" || isProviderHost(hostname, "openrouter.ai")) return "openrouter";
  if (m.includes("/") && (m.includes("veo") || m.includes("wan"))) return "openrouter";
  if (m === "google_veo" || m === "veo" || /^veo-[\d.]+/.test(m)) return "google_veo";
  if (m === "xai" || isProviderHost(hostname, "x.ai")) return "xai";
  if (m.includes("grok") && m.includes("imagine") && m.includes("video")) return "xai";
  return "gemini_omni";
}

/**
 * Infer which image generation API source to use from the model name and base URL.
 * The caller should fall back to "openai" (OpenAI-compatible) if no match is found.
 */
export function inferImageSource(model: string, baseUrl: string): string {
  const m = model.toLowerCase();
  const u = baseUrl.toLowerCase();
  let hostname = "";
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    // Keep inference best-effort for incomplete custom URLs while they are edited.
  }
  if (
    m === "openai" ||
    m === "codex_chatgpt" ||
    m === "stability" ||
    m === "togetherai" ||
    m === "arli" ||
    m === "novelai" ||
    m === "pollinations" ||
    m === "horde" ||
    m === "blockentropy" ||
    m === "openrouter" ||
    m === "xai" ||
    m === "venice" ||
    m === "zai" ||
    m === "atlas" ||
    m === "fal" ||
    m === "spicyapi" ||
    m === "comfyui" ||
    m === "swarmui" ||
    m === "automatic1111" ||
    m === "runpod_comfyui" ||
    m === "gemini_image"
  ) {
    return m;
  }
  if (m === "drawthings") return "automatic1111";
  if (hostname === "fal.run") return "fal";
  if (isProviderHost(hostname, "spicyapi.ai")) return "spicyapi";
  if (isProviderHost(hostname, "nano-gpt.com")) return "nanogpt";
  if (isProviderHost(hostname, "openrouter.ai")) return "openrouter";
  if (isProviderHost(hostname, "x.ai")) return "xai";
  if (isProviderHost(hostname, "venice.ai")) return "venice";
  if (isProviderHost(hostname, "api.z.ai")) return "zai";
  if (isProviderHost(hostname, "atlascloud.ai")) return "atlas";
  if (isProviderHost(hostname, "arliai.com")) return "arli";
  if (m.startsWith("fal-ai/")) return "fal";
  if (m === "glm-image" || m.startsWith("cogview")) return "zai";
  if (m.startsWith("grok-") && m.includes("image")) return "xai";
  if (m.includes("grok") && m.includes("imagine")) return "xai";
  if (m.startsWith("dall-e") || m.startsWith("gpt-image") || isProviderHost(hostname, "openai.com")) return "openai";
  if (m.startsWith("sd3") || isProviderHost(hostname, "stability.ai")) return "stability";
  if (m.includes("nai-diffusion") || isProviderHost(hostname, "novelai.net")) return "novelai";
  if (m === "pollinations" || isProviderHost(hostname, "pollinations.ai")) return "pollinations";
  if (m.includes("black-forest") || m.includes("flux") || isProviderHost(hostname, "together.xyz")) return "togetherai";
  if (isProviderHost(hostname, "stablehorde.net")) return "horde";
  if (isProviderHost(hostname, "blockentropy.ai")) return "blockentropy";
  if (u.includes(":7801") || u.includes("swarmui")) return "swarmui";
  if (u.includes(":8188") || u.includes("comfyui")) return "comfyui";
  if (isProviderHost(hostname, "runpod.ai")) return "runpod_comfyui";
  if (u.includes(":7860") && !u.includes("drawthings")) return "automatic1111";
  // Gemini image models generate via chat completions (native or proxy)
  if (m.includes("gemini") && m.includes("image")) return "gemini_image";
  if (m.includes("imagen")) return "gemini_image";
  // OpenAI-compatible fallback (works for most proxies)
  return "openai";
}

// ── Provider → Model map ──

export const MODEL_LISTS: Record<APIProvider, KnownModel[]> = {
  openai: OPENAI_MODELS,
  openai_chatgpt: OPENAI_CHATGPT_MODELS,
  anthropic: ANTHROPIC_MODELS,
  claude_subscription: CLAUDE_SUBSCRIPTION_MODELS,
  grok_subscription: GROK_SUBSCRIPTION_MODELS,
  google: GOOGLE_MODELS,
  google_vertex: GOOGLE_MODELS,
  mistral: MISTRAL_MODELS,
  cohere: COHERE_MODELS,
  openrouter: OPENROUTER_MODELS,
  nanogpt: [], // NanoGPT aggregator — models fetched dynamically via API
  xai: XAI_MODELS,
  arli: [], // Arli AI — models fetched dynamically via the /models endpoint
  zai: ZAI_MODELS,
  deepseek: DEEPSEEK_MODELS,
  // Seed OAI-compatible endpoints with the OpenAI catalog; remote /models still merge on top.
  custom: [...OPENAI_MODELS, ...ZAI_MODELS],
  image_generation: IMAGE_GEN_MODELS,
  video_generation: VIDEO_GEN_MODELS,
  audio: AUDIO_GEN_MODELS,
  decision: [],
};

const OPENAI_COMPATIBLE_AGGREGATOR_MODELS: KnownModel[] = [
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...GOOGLE_MODELS,
  ...DEEPSEEK_MODELS,
  ...MIMO_MODELS,
  ...MOONSHOT_MODELS,
  ...ZAI_MODELS,
  ...XAI_MODELS,
];

/**
 * Variant suffixes proxies add to a catalog id: thinking switches (new-api `-thinking[-<budget>]`/`-nothinking`,
 * AiHubMix `-think`/`-nothink`), effort tails (new-api, AiHubMix `gpt-5.4-high`), AiHubMix `-search`, LinkAPI `-r`,
 * Chutes `-tee`, and date pins (`-20250929`, `-2024-08-06`, `-0731`). findKnownModel removes them one at a time,
 * and only while the id is still unknown, so a real catalog id that ends the same way (`command-r`,
 * `gpt-5.1-codex-max`, `grok-4-0709`) always matches as it is.
 */
const PROXY_MODEL_SUFFIX_RE =
  /-(?:thinking(?:-\d+)?|think|nothinking|nothink|no-thinking|non-thinking|none|minimal|low|medium|high|xhigh|max|search|r|tee|\d{4}-\d{2}-\d{2}|\d{8}|\d{4})$/u;

/**
 * The catalog form of a proxy or gateway id: no tags or modifiers, no namespace path (OpenRouter, Bifrost and
 * LiteLLM `vendor/…`, Chutes `deepseek-ai/…`, CLIProxyAPI `provider://…`), no `:variant` (OpenRouter `:free`, NanoGPT
 * `:thinking`), no Bedrock wrapper (`us.anthropic.…-v1:0`), Vertex date pins as Anthropic's (`@20250805` is
 * `-20250805`), and hyphenated Claude versions (Poe and OpenRouter `claude-opus-4.6`).
 */
export function catalogModelId(modelId: string): string {
  return (
    capabilityModelId(modelId.trim().replace(/@(\d{8})$/u, "-$1"))
      .split("/")
      .pop() ?? ""
  )
    .split(":", 1)[0]!
    .replace(/^(?:[a-z]+\.)?anthropic\.(claude-.+)-v\d+$/u, "$1")
    .replace(/^(claude-(?:opus|sonnet|haiku|fable|mythos)-\d+)\.(\d+)/u, "$1-$2");
}

/**
 * Look up a known model by ID across all providers. A proxy id resolves to the catalog model it serves:
 * `[次]claude-opus-4-6-thinking` is `claude-opus-4-6`.
 */
export function findKnownModel(provider: APIProvider, modelId: string): KnownModel | undefined {
  const exact = MODEL_LISTS[provider]?.find((model) => model.id === modelId);
  if (exact) return exact;

  // Aggregators namespace model IDs (for example, `deepseek/deepseek-v4-pro`)
  // while direct OAI-compatible endpoints generally do not. Resolve both
  // forms without exposing a large, stale static list in their model pickers.
  const catalog =
    provider === "openrouter" || provider === "nanogpt" || provider === "custom"
      ? OPENAI_COMPATIBLE_AGGREGATOR_MODELS
      : MODEL_LISTS[provider];
  if (!catalog?.length) return undefined;
  let id = catalogModelId(modelId);
  // At most 4 suffix passes: a crafted imported id must not loop once per character.
  for (let pass = 0; ; pass++) {
    const known = catalog.find((model) => model.id.toLowerCase() === id);
    const shorter = id.replace(PROXY_MODEL_SUFFIX_RE, "");
    if (known || shorter === id || pass === 4) return known;
    id = shorter;
  }
}

/** How a target catalog model matches a Model that moves to another service: same id, same id after the gateway path, same catalog model. */
export type ModelMoveMatch = "exact" | "prefix" | "catalog";
export interface ModelMoveCandidate<T> {
  model: T;
  match: ModelMoveMatch;
  /** Another behaviour or billing variant (`:thinking`, `:free`, `[1m]`, `@thinking:on`): the user must confirm it. */
  variant: boolean;
}

/** The behaviour/billing tail of an id: its `:variant` and bracket or `@` modifiers. Vertex date pins are not variants. */
function modelVariantTag(modelId: string): string {
  const last =
    modelId
      .trim()
      .toLowerCase()
      .replace(/@(\d{8})$/u, "-$1")
      .split("/")
      .pop() ?? "";
  const base = stripModifierSuffix(last);
  const colon = base.indexOf(":");
  return `${colon >= 0 ? base.slice(colon) : ""}${last.slice(base.length).replace(/\s+/gu, "")}`;
}

/**
 * Target catalog models that serve the same model as `sourceId`, best first: the exact id, the id without its gateway
 * path (`nanogpt/…`, Bifrost `vendor/…`), then the same catalog model (`catalogModelId`). A match with another variant
 * tail is never a suggestion on its own: it is flagged and ranked after the plain matches.
 */
export function rankModelMoveCandidates<T extends { id: string }>(
  sourceId: string,
  models: readonly T[],
): Array<ModelMoveCandidate<T>> {
  const source = sourceId.trim();
  const sourceLast = source.toLowerCase().split("/").pop() ?? "";
  const sourceCatalog = catalogModelId(source);
  const sourceTag = modelVariantTag(source);
  const rank = { exact: 0, prefix: 1, catalog: 2 } as const;
  const hits: Array<ModelMoveCandidate<T>> = [];
  for (const model of models) {
    const match: ModelMoveMatch | null =
      model.id === source
        ? "exact"
        : model.id.toLowerCase().split("/").pop() === sourceLast
          ? "prefix"
          : sourceCatalog && catalogModelId(model.id) === sourceCatalog
            ? "catalog"
            : null;
    if (match) hits.push({ model, match, variant: modelVariantTag(model.id) !== sourceTag });
  }
  // Stable sort: within one rank the catalog order stays.
  return hits.sort((a, b) => Number(a.variant) - Number(b.variant) || rank[a.match] - rank[b.match]);
}

function normalizeProviderForCatalog(provider: APIProvider | string): APIProvider | null {
  const normalized = provider.replace(/-/g, "_");
  return normalized in MODEL_LISTS ? (normalized as APIProvider) : null;
}

export function shouldSuppressUnknownModelParameters(
  provider: APIProvider | string | null | undefined,
  modelId: string | null | undefined,
): boolean {
  if (!provider || !modelId?.trim()) return false;
  const normalizedProvider = normalizeProviderForCatalog(provider);
  if (!normalizedProvider) return false;
  // Custom OAI-compatible endpoints are user-defined. Their explicit parameter
  // switches are the compatibility policy; a built-in catalog cannot know what
  // an arbitrary endpoint accepts.
  if (normalizedProvider === "custom") return false;
  const catalog = MODEL_LISTS[normalizedProvider];
  if (!catalog || catalog.length === 0) return false;
  return !findKnownModel(normalizedProvider, modelId.trim());
}

// ── Cost badges ──

/** How a whole Connection is paid for, when one word says it: a plan, or a free community service. */
export type ConnectionBilling = "plan" | "free" | null;

/** What one model of a catalog costs: in the subscription (with an input-token multiplier), free, paid, or unknown. */
export type ConnectionModelCost = "included" | `multiplier:${number}` | "free" | "paid" | null;

/** Model prices in USD per million tokens, as the provider's list gives them. */
export interface ModelCatalogPricing {
  prompt?: number;
  completion?: number;
}

/** One model of a saved catalog as `GET /connections/:id/models` serves it. */
export interface ConnectionCatalogModel {
  id: string;
  name: string;
  context?: number;
  maxOutput?: number;
  capabilities?: unknown;
  /** NanoGPT subscription: whether the model is in the plan, and its input-token multiplier. */
  subscriptionIncluded?: boolean;
  inputTokenMultiplier?: number;
  pricing?: ModelCatalogPricing;
  inputModalities?: string[];
  outputModalities?: string[];
  free?: true;
  deprecated?: true;
  /** When the provider retires the model (ISO date as the provider gives it). */
  retiresAt?: string;
  /** Left out when unknown. */
  cost?: Exclude<ConnectionModelCost, null>;
}

/** A Model's own answer to "can it read images?"; null (Automatic) lets its catalog decide. */
export const MODEL_IMAGE_INPUTS = ["reads", "text"] as const;
export type ModelImageInput = (typeof MODEL_IMAGE_INPUTS)[number];

/**
 * Whether a Model reads images: its own setting first, then the catalog's input modalities. null means unknown,
 * and the images are then sent as they are. The on-device model never reads images.
 */
export function modelReadsImages(
  row: { id?: string | null; imageInput?: string | null },
  catalogModel?: { inputModalities?: readonly string[] } | null,
): boolean | null {
  if (row.id === LOCAL_SIDECAR_CONNECTION_ID) return false;
  if (row.imageInput === "reads") return true;
  if (row.imageInput === "text") return false;
  const modalities = catalogModel?.inputModalities;
  return modalities?.length ? modalities.includes("image") : null;
}

/**
 * Plan badges for proxy models named `nanogpt/<id>`: "on" reads NanoGPT's public model list (no key is sent),
 * "off" keeps them without; unset, the Connections panel asks once.
 */
export const NANOGPT_PLAN_BADGES_SETTINGS_KEY = "nanogpt-plan-badges";

/** Image sources run by volunteers or free for everyone: the whole Connection is free. */
const FREE_IMAGE_SOURCES = new Set(["horde", "pollinations"]);

export function connectionBilling(row: {
  provider: string;
  baseUrl?: string | null;
  model?: string | null;
  imageGenerationSource?: string | null;
  imageService?: string | null;
}): ConnectionBilling {
  if (PROVIDERS[row.provider as APIProvider]?.billing === "plan") return "plan";
  if (row.provider !== "image_generation") return null;
  const source =
    row.imageGenerationSource?.trim() ||
    row.imageService?.trim() ||
    inferImageSource(row.model ?? "", (row.baseUrl ?? "").trim());
  return FREE_IMAGE_SOURCES.has(source) ? "free" : null;
}

/** The cost badge of one catalog model. Subscription coverage wins over price; a free Connection makes all free. */
export function modelCost(
  model: {
    subscriptionIncluded?: unknown;
    inputTokenMultiplier?: unknown;
    free?: unknown;
    pricing?: unknown;
  },
  billing: ConnectionBilling,
): ConnectionModelCost {
  if (model.subscriptionIncluded === true) {
    const multiplier = model.inputTokenMultiplier;
    return typeof multiplier === "number" && Number.isFinite(multiplier) && multiplier > 1
      ? `multiplier:${multiplier}`
      : "included";
  }
  if (billing === "free" || model.free === true) return "free";
  if (model.subscriptionIncluded === false) return "paid";
  const pricing = model.pricing as ModelCatalogPricing | null | undefined;
  if (pricing && typeof pricing === "object" && ((pricing.prompt ?? 0) > 0 || (pricing.completion ?? 0) > 0)) {
    return "paid";
  }
  return null;
}
