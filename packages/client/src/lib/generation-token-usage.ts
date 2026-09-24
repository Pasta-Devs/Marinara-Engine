/**
 * One turn's reported token usage, normalized across providers. Claude-native APIs (Anthropic, Claude
 * subscription) report uncached input apart from cache reads and writes, so their input total is the sum;
 * other providers report the total with the cached part inside it. `cacheHitRatio` is cache reads over the
 * whole input, or null when the provider did not report enough to compute it.
 */
export interface GenerationTokenUsageInput {
  provider?: string | null;
  tokensPrompt?: number | null;
  tokensCompletion?: number | null;
  tokensCachedPrompt?: number | null;
  tokensCacheWritePrompt?: number | null;
}

export interface NormalizedGenerationTokenUsage {
  freshInput: number | null;
  inputTotal: number | null;
  inputTotalExact: boolean;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  cacheHitRatio: number | null;
}

function isClaudeSubscription(provider: string | null | undefined): boolean {
  return typeof provider === "string" && provider.toLowerCase() === "claude_subscription";
}

function isAnthropicApi(provider: string | null | undefined): boolean {
  return typeof provider === "string" && provider.toLowerCase() === "anthropic";
}

function reportedCount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function normalizeGenerationTokenUsage(
  generationInfo: GenerationTokenUsageInput | null | undefined,
): NormalizedGenerationTokenUsage | null {
  if (!generationInfo) return null;
  const reportedPrompt = reportedCount(generationInfo.tokensPrompt);
  const cacheRead = reportedCount(generationInfo.tokensCachedPrompt);
  const cacheWrite = reportedCount(generationInfo.tokensCacheWritePrompt);
  const claudeSubscription = isClaudeSubscription(generationInfo.provider);
  // Claude-native APIs report uncached input separately from cache reads and writes.
  const claudeNative = claudeSubscription || isAnthropicApi(generationInfo.provider);
  const freshInput = claudeNative ? reportedPrompt : null;
  // The Anthropic API provider omits zero cache fields, so a missing field counts as 0 there.
  const inputTotalExact = claudeSubscription
    ? freshInput != null && cacheRead != null && cacheWrite != null
    : reportedPrompt != null;
  const inputTotal = claudeNative
    ? inputTotalExact
      ? (freshInput ?? 0) + (cacheRead ?? 0) + (cacheWrite ?? 0)
      : null
    : reportedPrompt;
  const cacheHitRatio =
    inputTotal != null && inputTotal > 0 && cacheRead != null && cacheRead <= inputTotal
      ? cacheRead / inputTotal
      : null;
  return {
    freshInput,
    inputTotal,
    inputTotalExact,
    output: reportedCount(generationInfo.tokensCompletion),
    cacheRead,
    cacheWrite,
    cacheHitRatio,
  };
}
