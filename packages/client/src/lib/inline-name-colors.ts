/**
 * Whether the chat persona's names are colored: the chat's own persona switch when it is set,
 * otherwise whatever the character switch resolved to, so a chat with coloring off is unchanged.
 */
export function resolvePersonaInlineNames(personaSetting: unknown, characterSetting: boolean): boolean {
  return typeof personaSetting === "boolean" ? personaSetting : characterSetting;
}

/** A card whose names can be painted in its name color inside message text. */
export interface InlineNameCard {
  name?: string | null;
  convoDisplayName?: string | null;
  nameAliases?: readonly string[] | null;
  nameColor?: string | null;
}

function cardNameKeys(card: InlineNameCard): string[] {
  const keys: string[] = [];
  for (const name of [card.name, card.convoDisplayName, ...(card.nameAliases ?? [])]) {
    const key = typeof name === "string" ? name.trim().toLowerCase() : "";
    if (key) keys.push(key);
  }
  return keys;
}

/**
 * Lowercased name → color for inline name coloring in Roleplay messages.
 *
 * Characters color their name, conversation display name and other names (`nameAliases`) when
 * `colorCharacters` is on. The chat's persona does the same when `colorPersona` is on. A name that
 * belongs to any of the chat's characters is never painted in the persona's color, whether or not
 * that character is colored, so a shared name keeps the character's look. `toColor` lets the caller
 * flatten gradients. Returns null when nothing would be colored.
 */
export function buildInlineNameColorMap({
  characters,
  persona,
  colorCharacters,
  colorPersona,
  toColor = (color) => color,
}: {
  characters: Iterable<InlineNameCard | null | undefined>;
  persona?: InlineNameCard | null;
  colorCharacters: boolean;
  colorPersona: boolean;
  toColor?: (color: string) => string;
}): Map<string, string> | null {
  const map = new Map<string, string>();
  const characterNames = new Set<string>();
  for (const character of characters) {
    if (!character) continue;
    const keys = cardNameKeys(character);
    for (const key of keys) characterNames.add(key);
    if (!colorCharacters || !character.nameColor) continue;
    const color = toColor(character.nameColor);
    for (const key of keys) map.set(key, color);
  }
  if (colorPersona && persona?.nameColor) {
    const color = toColor(persona.nameColor);
    for (const key of cardNameKeys(persona)) {
      if (!characterNames.has(key)) map.set(key, color);
    }
  }
  return map.size > 0 ? map : null;
}
