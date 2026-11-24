// ──────────────────────────────────────────────
// Model families: which product line a model id belongs to (Claude, GPT, Qwen…), so a long
// account list can be narrowed by family. Matched from the id alone, after the decorations
// proxies add ("[SP] ", "anthropic/", ":free") are gone. An id no rule knows is "other".
// ──────────────────────────────────────────────

import { bareCapabilityModelId } from "@marinara-engine/shared";

export type ModelFamily =
  | "claude"
  | "gpt"
  | "gemini"
  | "gemma"
  | "deepseek"
  | "qwen"
  | "llama"
  | "mistral"
  | "grok"
  | "glm"
  | "kimi"
  | "minimax"
  | "command"
  | "phi"
  | "nemotron"
  | "hermes"
  | "yi"
  | "ernie"
  | "doubao"
  | "hunyuan"
  | "step"
  | "other";

/** Product names, shown as they are in every language; "other" is translated by the UI. */
export const MODEL_FAMILY_LABELS: Record<Exclude<ModelFamily, "other">, string> = {
  claude: "Claude",
  gpt: "GPT",
  gemini: "Gemini",
  gemma: "Gemma",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  llama: "Llama",
  mistral: "Mistral",
  grok: "Grok",
  glm: "GLM",
  kimi: "Kimi",
  minimax: "MiniMax",
  command: "Command",
  phi: "Phi",
  nemotron: "Nemotron",
  hermes: "Hermes",
  yi: "Yi",
  ernie: "ERNIE",
  doubao: "Doubao",
  hunyuan: "Hunyuan",
  step: "Step",
};

// First match wins. Fine-tunes and distills name their base model too ("hermes-3-llama-3.1",
// "deepseek-r1-distill-qwen"), so the line that made them comes before the bases. Short names
// (phi, yi, step, command, o1) only match as a whole word: "dolphin" is not Phi.
const RULES: ReadonlyArray<readonly [RegExp, ModelFamily]> = [
  [/hermes/, "hermes"],
  [/nemotron/, "nemotron"],
  [/deepseek/, "deepseek"],
  [/claude/, "claude"],
  [/gemini/, "gemini"],
  [/gemma/, "gemma"],
  [/qwen|qwq/, "qwen"],
  [/mistral|mixtral|codestral|magistral|ministral|devstral|pixtral/, "mistral"],
  [/llama/, "llama"],
  [/grok/, "grok"],
  [/glm/, "glm"],
  [/kimi|moonshot/, "kimi"],
  [/minimax/, "minimax"],
  [/(?:^|[^a-z])command(?:$|[^a-z])/, "command"],
  [/(?:^|[^a-z])phi-?\d/, "phi"],
  [/(?:^|[^a-z])yi(?:$|[^a-z])/, "yi"],
  [/ernie/, "ernie"],
  [/doubao/, "doubao"],
  [/hunyuan/, "hunyuan"],
  [/(?:^|[^a-z])step-?\d/, "step"],
  // OpenAI's reasoning ids are o1, o3-mini, o4-mini-high…; "gpt-4o" is caught by the gpt test.
  [/gpt|openai|^o\d(?:$|[-_.])/, "gpt"],
];

/** The id with proxy decorations removed: bracket tags, any path before the last "/", and a ":tag". */
/**
 * The names a model id may go by, best first. The shared capability id drops proxy decorations (bracket tags such
 * as "[SP] " or "【限时】", "(high)" and "@date" modifiers, the path before the last "/"). Around a colon the name
 * usually comes first ("claude-sonnet-4:free"), but a gateway or fine-tune prefix can come first instead
 * ("groq:llama-3.1-8b", OpenAI's "ft:gpt-4o-mini:org::id"), so the part after it is tried next.
 */
function modelNames(modelId: string): string[] {
  const [head = "", next = ""] = bareCapabilityModelId(modelId).split(":");
  return [head.trim(), next.trim()].filter(Boolean);
}

export function modelFamilyOf(modelId: string): ModelFamily {
  for (const id of modelNames(modelId)) for (const [pattern, family] of RULES) if (pattern.test(id)) return family;
  return "other";
}

export type ModelFamilyChip = { family: ModelFamily; count: number };

/**
 * The family chips for a list: most models first, "other" last. None for a short list, or for one with fewer than
 * two named families (a single maker's account has nothing to narrow).
 */
export function familyChipsFor(
  modelIds: readonly string[],
  { minList = 20 }: { minList?: number } = {},
): ModelFamilyChip[] {
  if (modelIds.length < minList) return [];
  const counts = new Map<ModelFamily, number>();
  for (const id of modelIds) {
    const family = modelFamilyOf(id);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  const named = [...counts]
    .filter(([family]) => family !== "other")
    .map(([family, count]) => ({ family, count }))
    // Ties keep a fixed order, so chips do not swap places when a list reloads.
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
  if (named.length < 2) return [];
  const other = counts.get("other");
  return other ? [...named, { family: "other", count: other }] : named;
}
