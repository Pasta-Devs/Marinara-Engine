export type SpriteCategory = "expressions" | "full-body";

export type CharacterSpriteImageConnection = {
  id: string;
  name: string;
  model?: string | null;
  provider?: string | null;
};

export const DEFAULT_EXPRESSIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "embarrassed",
  "thinking",
  "laughing",
  "worried",
  "scared",
  "disgusted",
  "love",
  "smirk",
  "crying",
  "determined",
  "hurt",
];

export function normalizeSpriteExpressionForCategory(raw: string, category: SpriteCategory): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  if (!cleaned) return "";
  if (category === "full-body") {
    return cleaned.startsWith("full_") ? cleaned : `full_${cleaned}`;
  }
  return cleaned.replace(/^full_/, "");
}

export function displaySpriteExpressionForCategory(stored: string, category: SpriteCategory): string {
  return category === "full-body" ? stored.replace(/^full_/, "") : stored;
}
