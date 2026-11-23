// ──────────────────────────────────────────────
// Model families: long model lists (a proxy with 164 models) split by family, one family at a time, the way
// SillyTavern divides its lists. The family is read from the model id: proxy tags like "[SP]", vendor paths like
// "anthropic/" and "accounts/fireworks/models/" are dropped first. Anything unknown is "Other".
// ──────────────────────────────────────────────

export type ModelFamily = { key: string; label: string };

/** Lists shorter than this get no family chips: they fit on a screen anyway. */
export const FAMILY_CHIPS_MIN = 20;

const FAMILIES: ReadonlyArray<{ key: string; label: string; test: RegExp }> = [
  { key: "claude", label: "Claude", test: /^(claude|anthropic)/ },
  { key: "gpt", label: "GPT", test: /^(gpt|chatgpt|o\d|openai|text-davinci|davinci|codex)/ },
  { key: "gemini", label: "Gemini", test: /^(gemini|gemma|google|palm|bison|learnlm)/ },
  { key: "deepseek", label: "DeepSeek", test: /^deepseek/ },
  { key: "grok", label: "Grok", test: /^(grok|xai)/ },
  { key: "glm", label: "GLM", test: /^(glm|chatglm|zai|z-ai|zhipu)/ },
  { key: "qwen", label: "Qwen", test: /^(qwen|qwq|qvq)/ },
  { key: "kimi", label: "Kimi", test: /^(kimi|moonshot)/ },
  { key: "llama", label: "Llama", test: /^(llama|meta-llama|codellama|hermes|nous)/ },
  { key: "mistral", label: "Mistral", test: /^(mistral|mixtral|magistral|ministral|codestral|devstral|pixtral)/ },
  { key: "minimax", label: "MiniMax", test: /^(minimax|abab)/ },
];

/** The id without proxy tags and vendor paths: "[SP]claude-opus-5-5" and "anthropic/claude-opus-5-5" both give "claude-opus-5-5". */
export function bareModelId(id: string): string {
  let value = id.trim().toLowerCase();
  // Leading tags: "[SP]", "(free)", "【x】".
  value = value.replace(/^(\s*[[(【][^\])】]*[\])】]\s*)+/, "");
  // Vendor paths: keep the last segment ("accounts/fireworks/models/llama-v3" -> "llama-v3").
  const slash = value.lastIndexOf("/");
  if (slash >= 0) value = value.slice(slash + 1);
  // "models/gemini-2.5-pro" style prefixes are covered above; "~" and ":" suffix tags stay.
  return value.replace(/^[\s:_-]+/, "");
}

export function familyOf(id: string): ModelFamily {
  const bare = bareModelId(id);
  // A vendor path names the family even when the model's own name does not ("anthropic/opus" is Claude).
  const whole = id
    .trim()
    .toLowerCase()
    .replace(/^(\s*[[(【][^\])】]*[\])】]\s*)+/, "");
  for (const family of FAMILIES) {
    if (family.test.test(bare) || family.test.test(whole)) return { key: family.key, label: family.label };
  }
  return OTHER;
}

export const OTHER: ModelFamily = { key: "other", label: "Other" };

/** The families in a list with their counts, biggest first, "Other" always last. */
export function familiesOf(ids: readonly string[]): Array<ModelFamily & { count: number }> {
  const counts = new Map<string, { family: ModelFamily; count: number }>();
  for (const id of ids) {
    const family = familyOf(id);
    const entry = counts.get(family.key);
    if (entry) entry.count += 1;
    else counts.set(family.key, { family, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) =>
      a.family.key === "other"
        ? 1
        : b.family.key === "other"
          ? -1
          : b.count - a.count || a.family.label.localeCompare(b.family.label),
    )
    .map(({ family, count }) => ({ ...family, count }));
}
