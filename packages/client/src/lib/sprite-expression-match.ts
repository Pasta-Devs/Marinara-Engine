export type SpriteExpressionLike = {
  expression: string;
};

const EXPRESSION_FALLBACKS: Record<string, string[]> = {
  afraid: ["scared", "fearful", "worried", "nervous", "neutral"],
  amused: ["laughing", "happy", "smirk", "smiling", "neutral"],
  anxious: ["nervous", "worried", "scared", "confused", "thinking", "neutral"],
  bashful: ["shy", "blushing", "embarrassed", "happy", "neutral"],
  blush: ["blushing", "embarrassed", "shy", "flustered", "happy", "neutral"],
  blushing: ["blush", "embarrassed", "shy", "flustered", "happy", "neutral"],
  bored: ["deadpan", "tired", "sleepy", "neutral", "default"],
  calm: ["neutral", "default", "idle", "happy"],
  cold: ["deadpan", "neutral", "default", "angry"],
  confusion: ["confused", "puzzled", "thinking", "neutral"],
  deadpan: ["neutral", "default", "bored", "tired"],
  delight: ["happy", "laughing", "amused", "excited", "neutral"],
  delighted: ["happy", "laughing", "amused", "excited", "neutral"],
  determined: ["serious", "focused", "angry", "neutral", "default"],
  doubtful: ["uncertain", "confused", "thinking", "worried", "neutral"],
  embarrassed: ["blushing", "blush", "shy", "flustered", "happy", "neutral"],
  excited: ["happy", "laughing", "surprised", "cheer", "neutral"],
  eye_roll: ["eyeroll", "annoyed", "deadpan", "bored", "neutral"],
  eyeroll: ["eye_roll", "annoyed", "deadpan", "bored", "neutral"],
  fearful: ["scared", "afraid", "worried", "nervous", "neutral"],
  flirty: ["smirk", "blushing", "happy", "amused", "neutral"],
  flustered: ["blushing", "embarrassed", "shy", "worried", "neutral"],
  focused: ["determined", "serious", "thinking", "neutral"],
  grin: ["happy", "laughing", "smile", "amused", "neutral"],
  happy: ["smile", "smiling", "laughing", "amused", "neutral"],
  hesitant: ["uncertain", "worried", "nervous", "thinking", "confused", "neutral"],
  joy: ["happy", "laughing", "smile", "excited", "neutral"],
  mischievous: ["smirk", "happy", "amused", "neutral"],
  nervous: ["worried", "anxious", "scared", "confused", "thinking", "neutral"],
  normal: ["neutral", "default", "idle", "calm"],
  pensive: ["thinking", "thoughtful", "sad", "neutral"],
  puzzled: ["confused", "thinking", "uncertain", "neutral"],
  scared: ["afraid", "fearful", "worried", "nervous", "neutral"],
  serious: ["determined", "focused", "neutral", "default"],
  shy: ["blushing", "embarrassed", "flustered", "happy", "neutral"],
  smile: ["happy", "smiling", "amused", "neutral"],
  smiling: ["happy", "smile", "amused", "neutral"],
  tender: ["happy", "soft", "blushing", "neutral", "default"],
  thoughtful: ["thinking", "pensive", "neutral", "default"],
  unsure: ["uncertain", "worried", "nervous", "confused", "thinking", "neutral"],
  uncertain: ["worried", "nervous", "confused", "thinking", "thoughtful", "neutral", "default"],
  worried: ["nervous", "anxious", "scared", "confused", "thinking", "neutral"],
};

const NEUTRAL_FALLBACKS = ["neutral", "default", "normal", "calm", "idle"];

export function normalizeSpriteExpressionKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^full[_\s-]+/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hasUsefulContainmentMatch(requested: string, candidate: string): boolean {
  if (requested.length < 3 || candidate.length < 3) return false;
  const requestedTokens = requested.split("_").filter(Boolean);
  const candidateTokens = candidate.split("_").filter(Boolean);
  return requestedTokens.includes(candidate) || candidateTokens.includes(requested);
}

function getFallbackKeys(expression: string): string[] {
  const normalized = normalizeSpriteExpressionKey(expression);
  if (!normalized) return [...NEUTRAL_FALLBACKS];

  const keys = new Set<string>([normalized]);
  const addFallbacks = (key: string) => {
    for (const fallback of EXPRESSION_FALLBACKS[key] ?? []) {
      keys.add(normalizeSpriteExpressionKey(fallback));
    }
  };

  addFallbacks(normalized);
  for (const part of normalized.split("_").filter(Boolean)) {
    keys.add(part);
    addFallbacks(part);
  }
  for (const fallback of NEUTRAL_FALLBACKS) {
    keys.add(fallback);
  }

  return [...keys];
}

export function resolveSpriteExpression<T extends SpriteExpressionLike>(
  sprites: readonly T[] | undefined,
  expression: string | null | undefined,
): T | null {
  const available = (sprites ?? []).filter((sprite) => sprite.expression.trim().length > 0);
  if (available.length === 0) return null;

  const requested = normalizeSpriteExpressionKey(expression ?? "");
  const keyed = available.map((sprite) => ({
    sprite,
    key: normalizeSpriteExpressionKey(sprite.expression),
  }));

  if (requested) {
    const exact = keyed.find((entry) => entry.key === requested);
    if (exact) return exact.sprite;

    const partial = keyed.find((entry) => hasUsefulContainmentMatch(requested, entry.key));
    if (partial) return partial.sprite;
  }

  for (const fallbackKey of getFallbackKeys(expression ?? "")) {
    const fallbackExact = keyed.find((entry) => entry.key === fallbackKey);
    if (fallbackExact) return fallbackExact.sprite;

    const fallbackPartial = keyed.find((entry) => hasUsefulContainmentMatch(fallbackKey, entry.key));
    if (fallbackPartial) return fallbackPartial.sprite;
  }

  return null;
}
