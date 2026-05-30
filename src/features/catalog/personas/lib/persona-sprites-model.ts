export type PersonaSpriteCategory = "expressions" | "full-body";

export const DEFAULT_PERSONA_SPRITE_EXPRESSIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "scared",
  "disgusted",
  "thinking",
  "laughing",
  "crying",
  "blushing",
  "smirk",
];

interface SpriteExpression {
  expression: string;
}

export function normalizeSpriteExpression(raw: string, category: PersonaSpriteCategory): string {
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

export function displaySpriteExpression(stored: string, category: PersonaSpriteCategory): string {
  return category === "full-body" ? stored.replace(/^full_/, "") : stored;
}

export function getPortraitExpressionNames(sprites: SpriteExpression[]): string[] {
  return sprites
    .filter((sprite) => !sprite.expression.toLowerCase().startsWith("full_"))
    .map((sprite) => sprite.expression);
}

export function getVisibleSprites<TSprite extends SpriteExpression>(
  sprites: TSprite[],
  category: PersonaSpriteCategory,
): TSprite[] {
  return sprites.filter((sprite) =>
    category === "full-body" ? sprite.expression.startsWith("full_") : !sprite.expression.startsWith("full_"),
  );
}

export function getExistingSpriteExpressions(
  sprites: SpriteExpression[],
  category: PersonaSpriteCategory,
): Set<string> {
  return new Set(sprites.map((sprite) => displaySpriteExpression(sprite.expression, category)));
}

export function getSuggestedSpriteExpressions(existingExpressions: Set<string>): string[] {
  return DEFAULT_PERSONA_SPRITE_EXPRESSIONS.filter((expression) => !existingExpressions.has(expression));
}
