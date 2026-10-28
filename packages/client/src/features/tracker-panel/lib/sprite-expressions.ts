import type { PresentCharacter } from "@marinara-engine/shared";
import type { SpriteInfo } from "../../../hooks/use-characters";
import { resolveSpriteExpression } from "../../../lib/sprite-expression-match";

export function isSpriteLookupCharacterId(characterId: string | null | undefined) {
  const id = characterId?.trim();
  return !!id && !id.startsWith("manual-") && !id.startsWith("party-npc:") && !id.startsWith("npc:");
}

export function getSpriteExpressionForCharacter(
  expressions: Record<string, string>,
  character: PresentCharacter,
  spriteCharacterId: string | null,
) {
  if (spriteCharacterId && expressions[spriteCharacterId]) return expressions[spriteCharacterId];
  if (character.characterId && expressions[character.characterId]) return expressions[character.characterId];
  if (character.name && expressions[character.name]) return expressions[character.name];
  return undefined;
}

export function getCharacterExpressionHint(character: PresentCharacter, spriteExpression?: string | null) {
  if (spriteExpression?.trim()) return spriteExpression.trim();
  const text = [character.mood, character.thoughts].filter(Boolean).join(" ").toLowerCase();
  if (/\b(angry|furious|rage|snarl|seeth)\b/.test(text)) return "angry";
  if (/\b(sad|sorrow|cry|tears|weep|grief)\b/.test(text)) return "sad";
  if (/\b(happy|joy|laugh|smile|cheer|delight|giggl)\b/.test(text)) return "happy";
  if (/\b(surpris|shock|gasp|startle)\b/.test(text)) return "surprised";
  if (/\b(scared|afraid|fear|panic|trembl)\b/.test(text)) return "scared";
  if (/\b(blush|embarrass|fluster|shy)\b/.test(text)) return "embarrassed";
  if (/\b(think|ponder|wonder|consider|hmm)\b/.test(text)) return "thinking";
  if (/\b(worr|anxious|nervous|concern|dread)\b/.test(text)) return "worried";
  if (/\b(smirk|sly|teas|mischiev)\b/.test(text)) return "smirk";
  if (/\b(determin|resolv|steadfast)\b/.test(text)) return "determined";
  return "neutral";
}

export function resolveSpriteUrl(sprites: SpriteInfo[] | undefined, expression: string) {
  const spriteList = (sprites ?? []).filter((sprite) => !sprite.expression.toLowerCase().startsWith("full_"));
  if (spriteList.length === 0) return null;
  return (resolveSpriteExpression(spriteList, expression) ?? spriteList[0])?.url ?? null;
}
