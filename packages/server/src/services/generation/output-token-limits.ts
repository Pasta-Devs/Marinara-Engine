import { findKnownModel, type APIProvider } from "@marinara-engine/shared";

function resolveKnownMaxOutputTokens(provider: APIProvider | string | null | undefined, model: string): number | null {
  const knownModel = provider ? findKnownModel(provider as APIProvider, model.trim()) : undefined;
  return knownModel?.maxOutput && knownModel.maxOutput > 0 ? Math.floor(knownModel.maxOutput) : null;
}

export function clampGenerationMaxOutputTokens(args: {
  provider: APIProvider | string | null | undefined;
  model: string;
  maxTokens: number;
  maxTokensOverride?: number | null;
}): number {
  let capped = Math.max(1, Math.floor(args.maxTokens));
  const knownMaxOutput = resolveKnownMaxOutputTokens(args.provider, args.model);
  if (knownMaxOutput !== null) capped = Math.min(capped, knownMaxOutput);
  if (
    typeof args.maxTokensOverride === "number" &&
    Number.isFinite(args.maxTokensOverride) &&
    args.maxTokensOverride > 0
  ) {
    capped = Math.min(capped, Math.floor(args.maxTokensOverride));
  }
  return capped;
}

const THINKING_HEADROOM_BY_EFFORT: Record<string, number> = {
  low: 1024,
  medium: 4096,
  high: 8192,
  xhigh: 12288,
  max: 16384,
};

/**
 * Extra output tokens to reserve for thinking on top of the visible answer budget, scaled by effort and never more
 * than twice the visible budget (at least 1024). Anthropic's adaptive thinking and agent calls on providers that count
 * reasoning inside max tokens both use this table.
 */
export function resolveThinkingHeadroom(effort: string | null | undefined, visibleMaxTokens: number): number {
  const requested = (effort ? THINKING_HEADROOM_BY_EFFORT[effort] : undefined) ?? 8192;
  return Math.min(requested, Math.max(1024, Math.floor(visibleMaxTokens * 2)));
}
