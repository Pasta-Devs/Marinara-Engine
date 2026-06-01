import { getSpriteOwnerId, getSpriteOwnerKind, makeSpriteOwnerKey, type SpriteOwnerKind } from "./sprite-owner-keys";

export function normalizeSpriteExpressionMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const expressions: Record<string, string> = {};
  for (const [key, expression] of Object.entries(value as Record<string, unknown>)) {
    if (typeof expression !== "string") continue;
    const trimmedKey = key.trim();
    const trimmedExpression = expression.trim();
    if (trimmedKey && trimmedExpression) expressions[trimmedKey] = trimmedExpression;
  }
  return expressions;
}

function getSpriteExpressionForOwner(
  expressions: Record<string, string>,
  ownerKind: SpriteOwnerKind,
  ownerId: string | null | undefined,
  displayName?: string | null,
): string | undefined {
  const id = ownerId?.trim();
  const candidates = [
    id ? makeSpriteOwnerKey(ownerKind, id) : null,
    id,
    displayName?.trim() || null,
  ].filter((candidate): candidate is string => !!candidate);
  for (const candidate of candidates) {
    const expression = expressions[candidate];
    if (expression) return expression;
  }
  return undefined;
}

export function getSpriteExpressionForOwnerKey(
  expressions: Record<string, string>,
  ownerKey: string,
  displayName?: string | null,
): string | undefined {
  const ownerKind = getSpriteOwnerKind(ownerKey);
  const ownerId = getSpriteOwnerId(ownerKey);
  const keyedExpression = expressions[ownerKey];
  if (keyedExpression) return keyedExpression;
  return getSpriteExpressionForOwner(expressions, ownerKind, ownerId, displayName);
}

export function getSpriteExpressionForCharacter(
  expressions: Record<string, string>,
  characterId: string | null | undefined,
  displayName?: string | null,
): string | undefined {
  return getSpriteExpressionForOwner(expressions, "character", characterId, displayName);
}

export function getSpriteExpressionForPersona(
  expressions: Record<string, string>,
  personaId: string | null | undefined,
  displayName?: string | null,
): string | undefined {
  return getSpriteExpressionForOwner(expressions, "persona", personaId, displayName);
}
