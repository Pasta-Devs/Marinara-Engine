import { normalizeTextForMatch } from "./text-matching.js";

/** Character card text fields that may describe several people on one card. */
export type CharacterCardCastSource = {
  name?: unknown;
  description?: unknown;
  personality?: unknown;
  scenario?: unknown;
  backstory?: unknown;
  appearance?: unknown;
};

const MAX_CAST_MEMBERS = 12;
const MAX_MEMBER_NAME_LENGTH = 60;

/** `[CHARACTER: Ana]`, `[Character - Julia]`, `[CHAR: Mira]` block headers. */
const BRACKET_HEADER_RE = /\[\s*(?:character|char)\s*(?:[:\-–—]\s*)([^\]\r\n]{1,60})\]/giu;
/** `Name: Ana`, `Full Name: Julia`, `**Name:** Mira` at the start of a line. */
const NAME_FIELD_RE = /^[\s*_\-•>]*(?:full\s+name|name)\s*[*_]*\s*[:：]\s*[*_]*\s*([^\r\n]{1,120})$/gimu;

function cleanMemberName(raw: string): string {
  return raw
    .replace(/[*_`"“”'‘’]/gu, "")
    .replace(/\s*\((?:[^()]*)\)\s*$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function looksLikePersonName(value: string): boolean {
  if (!value || value.length > MAX_MEMBER_NAME_LENGTH) return false;
  if (/[.!?;]/u.test(value)) return false;
  return value.split(" ").length <= 5;
}

function collectFromPattern(text: string, pattern: RegExp, into: Map<string, string>): void {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const name = cleanMemberName(match[1] ?? "");
    if (!looksLikePersonName(name)) continue;
    const key = normalizeTextForMatch(name);
    if (key && !into.has(key)) into.set(key, name);
  }
}

/**
 * Detect the people described by one character card.
 *
 * Cards that bundle a cast (a scenario card with a mother and a daughter, a
 * party of adventurers) usually mark each person with a `[CHARACTER: Name]`
 * header or repeated `Name:` fields. Returns the distinct member names when at
 * least two are found and an empty list otherwise, so a normal single-person
 * card is never treated as a cast. The card's own name is never a member.
 */
export function extractCharacterCardCastMembers(card: CharacterCardCastSource): string[] {
  const fields = [card.description, card.personality, card.scenario, card.backstory, card.appearance];
  const text = fields.filter((value): value is string => typeof value === "string" && value.length > 0).join("\n");
  if (!text) return [];

  const cardNameKey = normalizeTextForMatch(card.name);
  const members = new Map<string, string>();
  collectFromPattern(text, BRACKET_HEADER_RE, members);
  if (members.size < 2) {
    members.clear();
    collectFromPattern(text, NAME_FIELD_RE, members);
  }
  if (cardNameKey) members.delete(cardNameKey);
  if (members.size < 2) return [];
  return [...members.values()].slice(0, MAX_CAST_MEMBERS);
}
