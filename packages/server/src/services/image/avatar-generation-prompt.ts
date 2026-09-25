import type { ImagePromptMode } from "@marinara-engine/shared";

const AVATAR_LEAD_TAG_FALLBACK = "solo, portrait, upper body, looking at viewer, centered composition";

/**
 * Lead prompt for the avatar "Generate with AI" path, which has no prompt-writing
 * LLM: the compiler keeps this text verbatim. Prose grammars get the classic
 * sentence. Tag grammars (Danbooru, tags) get nothing when the profile's avatar
 * subject tags already carry the composition, and a tag-only fallback otherwise,
 * so a prose clause never lands inside a tag prompt.
 */
export function buildAvatarPortraitLeadPrompt(args: {
  name: string;
  profileSubjectTags: string;
  promptMode: ImagePromptMode;
}): string {
  const name = args.name.trim() || "Character";
  const hasSubjectTags = args.profileSubjectTags.trim().length > 0;
  const taggedGrammar = args.promptMode === "danbooru" || args.promptMode === "tagged";
  if (taggedGrammar) return hasSubjectTags ? "" : AVATAR_LEAD_TAG_FALLBACK;
  if (hasSubjectTags) return `Create a polished character avatar portrait for ${name}.`;
  return `Create a polished character avatar portrait for ${name}. Composition: centered face-and-shoulders portrait, readable expression, clear silhouette, suitable as a chat avatar.`;
}
