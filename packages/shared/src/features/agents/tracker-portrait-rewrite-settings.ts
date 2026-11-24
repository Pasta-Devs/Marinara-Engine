/**
 * Optional AI prompt rewriter for Character Tracker portraits (#9748). Distills card override tags,
 * temporary tracker look details, scene mood, and upper-body outfit elements into one portrait prompt
 * while keeping identity tags verbatim and omitting lower-body clothes that cause split compositions.
 */
export const DEFAULT_TRACKER_PORTRAIT_REWRITE_PROMPT = [
  "Write one concise image generation prompt for a single Character Tracker portrait.",
  "Return only the prompt text as a single line, with no headings, quotes, code fences, or commentary.",
  "Keep every non-expression tag in imageAppearance verbatim (character/series tags, LoRA triggers, weights like 1.15::...::, hair, eyes, skin, build, permanent markings).",
  "Use look only for genuinely new or temporary visual details not already covered by imageAppearance (such as injuries, dirt, sweat, wet hair, flushed skin, or headwear). Omit traits already covered.",
  "When mood is present, express it visually in the character's face or posture. Only if mood conflicts with a default expression tag in imageAppearance (such as smile when mood is sad, angry, scared, or flustered), replace that expression tag with the scene mood while keeping all other imageAppearance tags verbatim.",
  "When outfit is present, keep only upper-body and portrait-visible clothing or accessories (tops, collars, jackets, scarves, earrings, necklaces, glasses, hats). Omit trousers, pants, skirts, legwear, footwear, and other lower-body garments when the portrait framing is upper body or head and shoulders.",
  "Do not repeat framing or quality tags already listed in portraitTags. If portraitTags is empty, start with brief single-subject upper-body portrait framing.",
  "Never invent physical traits or clothing not stated in the input JSON. Output lowercase comma-separated visual tags when promptMode is danbooru or tagged, or when imageAppearance or portraitTags uses comma-separated tags; otherwise write one short sentence of clear visual prose.",
].join("\n");

export interface TrackerPortraitRewriteSettings {
  /** Whether the Character Tracker runs the AI prompt rewrite pass before generating portraits. */
  enabled: boolean;
  /** The system instruction sent to the rewriter; falls back to the built-in default when blank. */
  prompt: string;
}

export function resolveTrackerPortraitRewriteSettings(
  settings: Record<string, unknown> | null | undefined,
): TrackerPortraitRewriteSettings {
  const saved = typeof settings?.portraitRewritePrompt === "string" ? settings.portraitRewritePrompt.trim() : "";
  return {
    enabled: settings?.rewritePortraitPrompts === true,
    prompt: saved || DEFAULT_TRACKER_PORTRAIT_REWRITE_PROMPT,
  };
}
