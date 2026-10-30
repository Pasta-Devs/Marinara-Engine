import {
  normalizeSpriteExpressionKey,
  resolveSpriteExpression,
  type SpriteExpressionLike,
} from "../../lib/sprite-expression-match";
import { isFullBodySpriteExpression, type SpriteDisplayMode } from "./sprite-display-modes";

function withoutFullBodyPrefix(value: string) {
  return value.toLowerCase().replace(/^full_/u, "");
}

function hasTokenContainmentMatch(requested: string, candidate: string) {
  if (requested.length < 3 || candidate.length < 3) return false;
  const requestedTokens = requested.split("_").filter(Boolean);
  const candidateTokens = candidate.split("_").filter(Boolean);
  return requestedTokens.includes(candidate) || candidateTokens.includes(requested);
}

export function resolveSpriteDisplayExpression<T extends SpriteExpressionLike>(
  sprites: readonly T[] | undefined,
  expression: string,
  displayModes: readonly SpriteDisplayMode[],
): T | null {
  const portraits = displayModes.includes("expressions")
    ? (sprites ?? []).filter((sprite) => !isFullBodySpriteExpression(sprite.expression))
    : [];
  const bodies = displayModes.includes("full-body")
    ? (sprites ?? []).filter((sprite) => isFullBodySpriteExpression(sprite.expression))
    : [];
  const pools = [bodies, portraits];
  const lower = expression.toLowerCase();
  const exactHandle = [...bodies, ...portraits].find((sprite) => sprite.expression.toLowerCase() === lower);
  if (exactHandle) {
    const sharedBody = !isFullBodySpriteExpression(exactHandle.expression)
      ? bodies.find(
          (sprite) =>
            withoutFullBodyPrefix(sprite.expression) === lower &&
            withoutFullBodyPrefix(sprite.label ?? sprite.expression) ===
              (exactHandle.label ?? exactHandle.expression).toLowerCase(),
        )
      : undefined;
    // Unchanged shared names retain the Engine's full-body preference. A renamed
    // portrait's concrete handle must not be mistaken for the other family's label.
    return sharedBody ?? exactHandle;
  }
  const bodyHandle = bodies.find((sprite) => withoutFullBodyPrefix(sprite.expression) === lower);
  if (bodyHandle) return bodyHandle;
  const find = (predicate: (value: string) => boolean) => {
    for (const pool of pools) {
      const match = pool.find(
        (sprite) =>
          predicate(sprite.expression.toLowerCase()) || predicate((sprite.label ?? sprite.expression).toLowerCase()),
      );
      if (match) return match;
    }
    return null;
  };
  const exact = find((value) => value === lower || withoutFullBodyPrefix(value) === lower);
  if (exact) return exact;
  const key = normalizeSpriteExpressionKey(expression);
  const partial = find((value) => {
    const spriteKey = normalizeSpriteExpressionKey(value);
    return hasTokenContainmentMatch(key, spriteKey) || hasTokenContainmentMatch(key, withoutFullBodyPrefix(spriteKey));
  });
  if (partial) return partial;
  for (const pool of pools) {
    const semantic = resolveSpriteExpression(pool, expression);
    if (semantic) return semantic;
  }
  return bodies[0] ?? portraits[0] ?? null;
}
