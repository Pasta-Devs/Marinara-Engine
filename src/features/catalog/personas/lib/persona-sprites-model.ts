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

const FULL_BODY_PREFIX_PATTERN = /^full_/i;

function hasFullBodyPrefix(expression: string): boolean {
  return FULL_BODY_PREFIX_PATTERN.test(expression);
}

function stripFullBodyPrefix(expression: string): string {
  return expression.replace(FULL_BODY_PREFIX_PATTERN, "");
}

export function normalizeSpriteExpression(raw: string, category: PersonaSpriteCategory): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  if (!cleaned) return "";
  if (category === "full-body") {
    return hasFullBodyPrefix(cleaned) ? cleaned : `full_${cleaned}`;
  }
  return stripFullBodyPrefix(cleaned);
}

export function displaySpriteExpression(stored: string, category: PersonaSpriteCategory): string {
  return category === "full-body" ? stripFullBodyPrefix(stored) : stored;
}

export function getPortraitExpressionNames(sprites: SpriteExpression[]): string[] {
  return sprites.filter((sprite) => !hasFullBodyPrefix(sprite.expression)).map((sprite) => sprite.expression);
}

export function getVisibleSprites<TSprite extends SpriteExpression>(
  sprites: TSprite[],
  category: PersonaSpriteCategory,
): TSprite[] {
  return sprites.filter((sprite) =>
    category === "full-body" ? hasFullBodyPrefix(sprite.expression) : !hasFullBodyPrefix(sprite.expression),
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
