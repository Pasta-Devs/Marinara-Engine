import type { SpriteAssetInfo, VisualAssetGateway } from "../../../capabilities/visual-assets";

export interface CharacterSpriteInfo {
  name: string;
  expressions: string[];
  expressionChoices: string[];
  /** Custom full-body aliases the model may intentionally choose. */
  fullBody: string[];
  /** Engine-assigned standard full-body poses; not exposed to the model. */
  automaticFullBody: string[];
}

export interface CharacterSpriteSubject {
  id: string;
  name: string;
}

const AUTOMATIC_FULL_BODY_POSES = new Set([
  "neutral",
  "default",
  "idle",
  "walk",
  "run",
  "battle_stance",
  "attack",
  "defend",
  "casting",
  "hurt",
  "jump",
  "thinking",
  "cheer",
  "victory",
  "wave",
  "sit",
  "kneel",
  "point",
]);

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const text = value.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}

function normalizeFullBodyAlias(expression: string): string | null {
  const trimmed = expression.trim();
  if (!trimmed.toLowerCase().startsWith("full_")) return null;
  const alias = trimmed.slice(5).trim();
  return alias || null;
}

function buildCharacterSpriteInfo(name: string, sprites: SpriteAssetInfo[]): CharacterSpriteInfo | null {
  const expressions: string[] = [];
  const fullBody: string[] = [];
  const automaticFullBody: string[] = [];

  for (const sprite of sprites) {
    const expression = typeof sprite.expression === "string" ? sprite.expression.trim() : "";
    if (!expression) continue;

    const fullBodyAlias = normalizeFullBodyAlias(expression);
    if (!fullBodyAlias) {
      expressions.push(expression);
      continue;
    }

    if (AUTOMATIC_FULL_BODY_POSES.has(fullBodyAlias.toLowerCase())) {
      automaticFullBody.push(fullBodyAlias);
    } else {
      fullBody.push(fullBodyAlias);
    }
  }

  const uniqueExpressions = uniqueStrings(expressions);
  const uniqueFullBody = uniqueStrings(fullBody);
  const uniqueAutomaticFullBody = uniqueStrings(automaticFullBody);
  if (uniqueExpressions.length === 0 && uniqueFullBody.length === 0) {
    return null;
  }

  return {
    name,
    expressions: uniqueExpressions,
    expressionChoices: buildSpriteExpressionChoices(uniqueExpressions),
    fullBody: uniqueFullBody,
    automaticFullBody: uniqueAutomaticFullBody,
  };
}

export async function loadCharacterSprites(
  visuals: VisualAssetGateway | undefined,
  subjects: CharacterSpriteSubject[],
): Promise<CharacterSpriteInfo[]> {
  if (!visuals || subjects.length === 0) return [];

  const rows = await Promise.all(
    subjects.map(async (subject) => {
      const sprites = await visuals.listSprites(subject.id, "character").catch(() => []);
      return buildCharacterSpriteInfo(subject.name, sprites);
    }),
  );

  return rows.filter((row): row is CharacterSpriteInfo => row !== null);
}

function getSpriteExpressionGroupKey(expression: string): string | null {
  const underscoreIndex = expression.indexOf("_");
  if (underscoreIndex <= 0) return null;
  const key = expression.slice(0, underscoreIndex).trim();
  return key || null;
}

/**
 * Collapse variant filenames like joy_01 / joy_blush into the simple group key
 * that the expression agent should see. The concrete filenames stay available
 * to sprite resolution so the UI can pick a matching saved sprite at runtime.
 */
export function buildSpriteExpressionChoices(expressions: string[]): string[] {
  const groupKeys = new Map<string, { key: string; count: number }>();

  for (const expression of expressions) {
    const groupKey = getSpriteExpressionGroupKey(expression);
    if (!groupKey) continue;

    const lookupKey = groupKey.toLowerCase();
    const existing = groupKeys.get(lookupKey);
    if (existing) {
      existing.count += 1;
    } else {
      groupKeys.set(lookupKey, { key: groupKey, count: 1 });
    }
  }

  const choices: string[] = [];
  const emitted = new Set<string>();

  for (const expression of expressions) {
    const groupKey = getSpriteExpressionGroupKey(expression);
    const group = groupKey ? groupKeys.get(groupKey.toLowerCase()) : undefined;
    const choice = group && group.count > 1 ? group.key : expression;
    const choiceLookup = choice.toLowerCase();
    if (emitted.has(choiceLookup)) continue;

    choices.push(choice);
    emitted.add(choiceLookup);
  }

  return choices;
}
