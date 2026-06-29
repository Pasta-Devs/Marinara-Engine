import {
  normalizeSpriteExpressionKey as normalizeUnicodeSpriteExpressionKey,
  normalizeSpriteLookupToken,
} from "@marinara-engine/shared";
import { buildSpriteExpressionChoices } from "../../services/game/sprite.service.js";

export type SpriteDisplayMode = "expressions" | "full-body";

export type AvailableSpriteCharacter = {
  characterId: string;
  characterName: string;
  expressions: string[];
  expressionChoices?: string[];
};

export type SpriteExpressionEntry = {
  characterId?: unknown;
  characterName?: unknown;
  expression?: unknown;
  transition?: unknown;
};

export type ExpressionValidationWarning = {
  message: string;
};

export type ExpressionValidationResult<T extends SpriteExpressionEntry> = {
  expressions: T[];
  warnings: ExpressionValidationWarning[];
};

export type SpriteExpressionCompletionOptions = {
  defaultSourceText?: string;
  sourceTextByCharacterId?: ReadonlyMap<string, string>;
};

const DEFAULT_SPRITE_DISPLAY_MODES: SpriteDisplayMode[] = ["expressions", "full-body"];

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function normalizeSpriteDisplayModes(value: unknown): SpriteDisplayMode[] {
  const rawModes = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const modes: SpriteDisplayMode[] = [];

  for (const mode of rawModes) {
    const normalized = mode === "fullBody" || mode === "full_body" ? "full-body" : mode;
    if (normalized === "expressions" && !modes.includes("expressions")) {
      modes.push("expressions");
    } else if (normalized === "full-body" && !modes.includes("full-body")) {
      modes.push("full-body");
    }
  }

  return modes.length > 0 ? modes : [...DEFAULT_SPRITE_DISPLAY_MODES];
}

export function buildAvailableSpriteCharacter(
  characterId: string,
  characterName: string,
  sprites: { expressions: string[]; fullBody: string[]; automaticFullBody: string[] },
  displayModes: readonly SpriteDisplayMode[],
): AvailableSpriteCharacter | null {
  const expressions = uniqueStrings([
    ...(displayModes.includes("expressions") ? sprites.expressions : []),
    ...(displayModes.includes("full-body") ? [...sprites.fullBody, ...sprites.automaticFullBody] : []),
  ]);

  if (expressions.length === 0) return null;
  return {
    characterId,
    characterName,
    expressions,
    expressionChoices: buildSpriteExpressionChoices(expressions),
  };
}

export function normalizeRequiredSpriteExpressionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function normalizeLookupToken(value: unknown): string {
  if (typeof value !== "string") return "";
  return normalizeSpriteLookupToken(value);
}

function normalizeNameAliases(name: string): string[] {
  const aliases = new Set<string>();
  const normalized = normalizeLookupToken(name);
  if (normalized) aliases.add(normalized);

  const withoutCommonTitle = name.replace(/^\s*(il|la|le|the)\s+/i, "");
  const normalizedWithoutTitle = normalizeLookupToken(withoutCommonTitle);
  if (normalizedWithoutTitle) aliases.add(normalizedWithoutTitle);

  return [...aliases];
}

function normalizeExpressionToken(value: string): string {
  return normalizeUnicodeSpriteExpressionKey(value).replace(/[._-]+/gu, "");
}

function hasUsefulContainmentMatch(candidate: string, option: string): boolean {
  if (candidate.length < 3 || option.length < 3) return false;
  return candidate.includes(option) || option.includes(candidate);
}

function pickRandomExpression(expressions: string[]): string | null {
  if (expressions.length === 0) return null;
  return expressions[Math.floor(Math.random() * expressions.length)] ?? expressions[0] ?? null;
}

function pickStableExpression(expressions: string[], sourceText: string): string | null {
  if (expressions.length === 0) return null;
  let hash = 2166136261;
  const seed = sourceText.trim() || expressions.join("|");
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return expressions[Math.abs(hash) % expressions.length] ?? expressions[0] ?? null;
}

function isOverSpecificFallbackExpression(expression: string): boolean {
  const normalized = normalizeExpressionToken(expression);
  return /(smirk|sly|teas|mischiev|wink|flirt|seduc)/.test(normalized);
}

function getExpressionPrefixVariant(expression: string, groupKey: string): boolean {
  const lower = expression.toLowerCase();
  const normalizedGroup = groupKey.trim().toLowerCase();
  return lower.startsWith(`${normalizedGroup}_`);
}

function resolveCharacter(
  entry: SpriteExpressionEntry,
  availableSprites: AvailableSpriteCharacter[],
): AvailableSpriteCharacter | null {
  const rawId = typeof entry.characterId === "string" ? entry.characterId.trim() : "";
  if (rawId) {
    const exactId = availableSprites.find((sprite) => sprite.characterId === rawId);
    if (exactId) return exactId;

    const caseInsensitiveId = availableSprites.find(
      (sprite) => sprite.characterId.toLowerCase() === rawId.toLowerCase(),
    );
    if (caseInsensitiveId) return caseInsensitiveId;
  }

  const candidates = [entry.characterName, entry.characterId]
    .map(normalizeLookupToken)
    .filter((candidate) => candidate.length > 0);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const exact = availableSprites.find((sprite) => {
      if (normalizeLookupToken(sprite.characterId) === candidate) return true;
      return normalizeNameAliases(sprite.characterName).includes(candidate);
    });
    if (exact) return exact;
  }

  for (const candidate of candidates) {
    const fuzzyName = availableSprites.find((sprite) =>
      normalizeNameAliases(sprite.characterName).some((alias) => hasUsefulContainmentMatch(candidate, alias)),
    );
    if (fuzzyName) return fuzzyName;
  }

  return null;
}

function resolveExpression(expression: string, availableExpressions: string[]): string | null {
  const trimmed = expression.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  const prefixMatches = availableExpressions.filter((entry) => getExpressionPrefixVariant(entry, trimmed));
  const exact = availableExpressions.find((entry) => entry.toLowerCase() === lower);
  if (prefixMatches.length > 1) {
    const groupPool = exact ? [exact, ...prefixMatches] : prefixMatches;
    const randomGroupMatch = pickRandomExpression(groupPool);
    if (randomGroupMatch) return randomGroupMatch;
  }

  if (exact) return exact;

  const normalized = normalizeExpressionToken(trimmed);
  const normalizedExact = availableExpressions.find((entry) => normalizeExpressionToken(entry) === normalized);
  if (normalizedExact) return normalizedExact;

  return (
    availableExpressions.find((entry) => {
      const option = normalizeExpressionToken(entry);
      return hasUsefulContainmentMatch(normalized, option);
    }) ?? null
  );
}

function inferExpressionCandidatesFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const candidates: string[] = [];

  const add = (...values: string[]) => {
    for (const value of values) {
      if (!candidates.includes(value)) candidates.push(value);
    }
  };

  if (/\b(blush|blushing|fluster|flustered|embarrass|embarrassed|shy|bashful)\b/.test(lower)) {
    add("blush", "embarrassed", "shy", "flustered");
  }
  if (/\b(angry|anger|rage|furious|annoyed|irritated|frustrated|glare|scowl)\b/.test(lower)) {
    add("angry", "annoyed", "irritated");
  }
  if (/\b(sad|cry|crying|tears|sorrow|grief|hurt|heartbroken|melancholy)\b/.test(lower)) {
    add("sad", "crying", "melancholy");
  }
  if (/\b(happy|smile|smiling|grin|grinning|laugh|laughing|joy|excited|delighted)\b/.test(lower)) {
    add("happy", "smile", "joy", "excited");
  }
  if (/\b(surprised|surprise|shock|shocked|gasp|startled|stunned)\b/.test(lower)) {
    add("surprised", "shocked", "startled");
  }
  if (/\b(scared|afraid|fear|fearful|terrified|panic|panicked|nervous|anxious)\b/.test(lower)) {
    add("scared", "afraid", "nervous", "anxious");
  }
  if (/\b(disgust|disgusted|gross|repulsed|repulsing)\b/.test(lower)) {
    add("disgusted", "disgust");
  }
  if (/\b(think|thinking|consider|considering|wonder|wondering|hmm|thoughtful|ponder)\b/.test(lower)) {
    add("thinking", "thoughtful", "ponder");
  }

  add("neutral", "default", "normal", "calm", "idle");
  return candidates;
}

function pickFallbackExpression(expressions: string[], sourceText: string): string | null {
  for (const candidate of inferExpressionCandidatesFromText(sourceText)) {
    const resolved = resolveExpression(candidate, expressions);
    if (resolved) return resolved;
  }

  const broadChoices = expressions.filter((expression) => !isOverSpecificFallbackExpression(expression));
  return pickStableExpression(broadChoices.length > 0 ? broadChoices : expressions, sourceText);
}

export function completeRequiredSpriteExpressionEntries<T extends SpriteExpressionEntry>(
  expressions: T[],
  availableSprites: AvailableSpriteCharacter[] | undefined,
  requiredCharacterIds: Iterable<string> | undefined,
  options: SpriteExpressionCompletionOptions = {},
): ExpressionValidationResult<T> {
  const warnings: ExpressionValidationWarning[] = [];
  if (!Array.isArray(availableSprites) || !requiredCharacterIds) {
    return { expressions, warnings };
  }

  const completed = [...expressions];
  const presentIds = new Set(
    completed
      .map((entry) => (typeof entry.characterId === "string" ? entry.characterId.trim() : ""))
      .filter((id) => id.length > 0),
  );

  for (const rawId of requiredCharacterIds) {
    const characterId = typeof rawId === "string" ? rawId.trim() : "";
    if (!characterId || presentIds.has(characterId)) continue;

    const character = availableSprites.find((sprite) => sprite.characterId === characterId);
    if (!character) continue;

    const sourceText = options.sourceTextByCharacterId?.get(characterId) ?? options.defaultSourceText ?? "";
    const expression = pickFallbackExpression(character.expressions, sourceText);
    if (!expression) continue;

    completed.push({
      characterId: character.characterId,
      characterName: character.characterName,
      expression,
      transition: "crossfade",
    } as T);
    presentIds.add(characterId);
    warnings.push({
      message: `Expression agent omitted ${character.characterName} — filled missing required expression "${expression}"`,
    });
  }

  return { expressions: completed, warnings };
}

export function validateSpriteExpressionEntries<T extends SpriteExpressionEntry>(
  expressions: T[] | undefined,
  availableSprites: AvailableSpriteCharacter[] | undefined,
): ExpressionValidationResult<T> {
  const warnings: ExpressionValidationWarning[] = [];
  if (!Array.isArray(expressions) || !Array.isArray(availableSprites)) {
    return { expressions: [], warnings };
  }

  const validated: T[] = [];
  for (const entry of expressions) {
    if (typeof entry.characterId !== "string" && typeof entry.characterName !== "string") {
      warnings.push({ message: "Malformed expression entry without character identity — skipping" });
      continue;
    }
    if (typeof entry.expression !== "string") {
      warnings.push({ message: "Malformed expression entry without expression — skipping" });
      continue;
    }

    const character = resolveCharacter(entry, availableSprites);
    const suppliedIdentity =
      typeof entry.characterId === "string" && entry.characterId.trim()
        ? entry.characterId.trim()
        : typeof entry.characterName === "string" && entry.characterName.trim()
          ? entry.characterName.trim()
          : "unknown";
    if (!character) {
      warnings.push({ message: `Expression agent returned unknown character "${suppliedIdentity}" — removing` });
      continue;
    }

    if (entry.characterId !== character.characterId) {
      warnings.push({
        message: `Expression agent used "${suppliedIdentity}" — resolved to ${character.characterName} (${character.characterId})`,
      });
    }

    const expression = resolveExpression(entry.expression, character.expressions);
    if (!expression) {
      warnings.push({
        message: `Expression agent chose "${entry.expression}" for ${character.characterName} which doesn't exist — removing`,
      });
      continue;
    }

    if (entry.expression !== expression) {
      warnings.push({
        message: `Expression agent chose "${entry.expression}" — correcting to closest match "${expression}"`,
      });
    }

    entry.characterId = character.characterId;
    entry.characterName = character.characterName;
    entry.expression = expression;
    validated.push(entry);
  }

  return { expressions: validated, warnings };
}
