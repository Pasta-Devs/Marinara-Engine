export type GameImageAssetKind = "background" | "illustration" | "portrait";

type ImagePromptSettings = {
  includeAppearances?: boolean;
  format?: "descriptive" | "tags";
};

export type GameImageGenerationPromptItem = {
  kind: GameImageAssetKind;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  referenceImages?: string[];
};

const GAME_PORTRAIT_NEGATIVE_PROMPT =
  "text, letters, captions, subtitles, UI, watermark, logo, signature, speech bubble, split screen, panel, collage, contact sheet, grid, four portraits, multiple portraits, duplicated face, extra head, extra person, bad anatomy, low quality";
const GAME_BACKGROUND_NEGATIVE_PROMPT =
  "text, letters, captions, subtitles, UI, watermark, logo, signature, people, character, portrait, split screen, panel, collage, contact sheet, grid, multiple frames, low quality";
const GAME_ILLUSTRATION_NEGATIVE_PROMPT =
  "text, letters, captions, subtitles, UI, watermark, logo, signature, speech bubble, split screen, panel, collage, contact sheet, character sheet, grid, four images, duplicated face, extra head, unrelated character, bad anatomy, low quality";

function joinedImageTags(parts: string[]): string {
  const seen = new Set<string>();
  return parts
    .flatMap((part) => part.split(/[,.]/))
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}

export function gameAssetNegativePrompt(kind: GameImageAssetKind): string {
  if (kind === "background") return GAME_BACKGROUND_NEGATIVE_PROMPT;
  if (kind === "illustration") return GAME_ILLUSTRATION_NEGATIVE_PROMPT;
  return GAME_PORTRAIT_NEGATIVE_PROMPT;
}

export function gameImageGenerationRequest(
  connectionId: string,
  item: GameImageGenerationPromptItem,
): Record<string, unknown> {
  return {
    connectionId,
    prompt: item.prompt,
    negativePrompt: item.negativePrompt,
    width: item.width,
    height: item.height,
    ...(item.kind === "illustration" && item.referenceImages?.length
      ? { referenceImages: item.referenceImages }
      : {}),
  };
}

const ANIMAL_SPECIES_PATTERN =
  "(?:cat|kitten|dog|puppy|wolf|fox|bird|raven|crow|owl|horse|deer|rat|mouse|snake|lizard)";
const ANIMAL_SUBJECT_MODIFIER_PATTERN =
  "(?:talking|sentient|sapient|magical|enchanted|cursed|actual|literal|small|large|giant|tiny|winged|black|white|gray|grey|red|brown|golden|silver|striped|spotted|tabby)";

function hasStrongNonHumanCue(value: string): boolean {
  return /\b(?:animal|dragon|beast|creature|monster|spirit|ghost|construct|golem|doll|object|statue|mascot|non[-\s]?human|anthropomorphic|feral|quadruped)\b/i.test(
    value,
  );
}

function hasAnimalSubjectCue(value: string): boolean {
  const animalSubjectPattern = new RegExp(
    `\\b${ANIMAL_SUBJECT_MODIFIER_PATTERN}\\s+${ANIMAL_SPECIES_PATTERN}\\b|\\b${ANIMAL_SPECIES_PATTERN}\\s+(?:creature|spirit|monster|beast|body|form|silhouette|wearing|with|who|that|curled|standing|sitting|walking|perched|coiled)\\b`,
    "i",
  );
  return animalSubjectPattern.test(value);
}

function hasExplicitNonHumanCue(value: string): boolean {
  return hasStrongNonHumanCue(value) || hasAnimalSubjectCue(value);
}

function hasExplicitNonHumanNameCue(value: string): boolean {
  return (
    /\b(?:dragon|construct|golem|doll|statue|mascot|non[-\s]?human|anthropomorphic|feral|quadruped)\b/i.test(value) ||
    (/\b(?:talking|sentient|sapient|magical|enchanted|cursed)\b/i.test(value) && hasExplicitNonHumanCue(value))
  );
}

function npcPortraitSpeciesRule(label: string, detail: string): string {
  const explicitNonHuman = hasExplicitNonHumanCue(detail) || hasExplicitNonHumanNameCue(label);
  return explicitNonHuman
    ? "The NPC details explicitly indicate a non-human subject. Preserve that exact species, body plan, age category, and silhouette; do not turn it into a human or kemonomimi character unless the details say humanoid."
    : "Unless the description explicitly says otherwise, depict this NPC as a human or humanoid person. Do not infer an animal species from the name, mood, speech verbs, or setting.";
}

export function sceneAssetPrompt(
  kind: GameImageAssetKind,
  label: string,
  detail: string,
  artStyle: string,
  settings: ImagePromptSettings,
): string {
  const style = artStyle.trim() || "polished fantasy visual novel art, cinematic lighting, high detail";
  const speciesRule = kind === "portrait" ? npcPortraitSpeciesRule(label, detail) : "";
  if (settings.format === "tags") {
    const detailPart = kind === "portrait" && settings.includeAppearances === false ? "" : detail;
    if (kind === "background") {
      return joinedImageTags([
        "wide establishing background",
        label,
        detail,
        style,
        "no characters",
        "no text",
        "immersive environment art",
      ]);
    }
    if (kind === "illustration") {
      return joinedImageTags([
        "cinematic scene illustration",
        label,
        detail,
        style,
        "dynamic composition",
        "no text",
        "high detail",
      ]);
    }
    return joinedImageTags([
      "portrait",
      label,
      detailPart,
      style,
      speciesRule,
      "centered bust portrait",
      "expressive face",
      "clean readable silhouette",
      "no text",
    ]);
  }
  if (kind === "background") {
    return `Wide establishing background of ${label}. ${detail}. ${style}. No characters, no text, immersive environment art.`;
  }
  if (kind === "illustration") {
    return `Cinematic scene illustration: ${label}. ${detail}. ${style}. Dynamic composition, no text, high detail.`;
  }
  if (settings.includeAppearances === false) {
    return `Portrait of ${label}. ${style}. ${speciesRule} Centered bust portrait, expressive face, clean readable silhouette, no text.`;
  }
  return `Portrait of ${label}. ${detail}. ${style}. ${speciesRule} Centered bust portrait, expressive face, clean readable silhouette, no text.`;
}
