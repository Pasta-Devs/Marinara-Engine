export const DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH = 5;
export const MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH = 200;
export const MAX_CUSTOM_AGENT_ACTIVATION_KEYWORDS = 100;

export function normalizeCustomAgentActivationKeywords(value: unknown): string[] {
  const rawKeywords = typeof value === "string" ? value.split(/\r?\n|,/) : Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const rawKeyword of rawKeywords) {
    if (typeof rawKeyword !== "string") continue;
    const keyword = rawKeyword.trim();
    if (!keyword) continue;
    const dedupeKey = keyword.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    keywords.push(keyword);
    if (keywords.length >= MAX_CUSTOM_AGENT_ACTIVATION_KEYWORDS) break;
  }

  return keywords;
}

export function normalizeCustomAgentActivationScanDepth(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH;
  return Math.max(1, Math.min(MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH, Math.floor(parsed)));
}
