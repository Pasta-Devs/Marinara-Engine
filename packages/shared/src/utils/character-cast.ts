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
function cleanMemberName(raw: string): string {
  let name = raw.replace(/[*_`"“”'‘’]/gu, "").trim();
  if (name.endsWith(")")) {
    const opening = name.lastIndexOf("(");
    if (opening >= 0 && !name.slice(opening + 1, -1).includes(")")) name = name.slice(0, opening);
  }
  return name.replace(/\s+/gu, " ").trim();
}

function looksLikePersonName(value: string): boolean {
  if (!value || value.length > MAX_MEMBER_NAME_LENGTH) return false;
  if (/[.!?;]/u.test(value)) return false;
  return value.split(" ").length <= 5;
}

function collectMemberName(raw: string, into: Map<string, string>): void {
  const name = cleanMemberName(raw);
  if (!looksLikePersonName(name)) return;
  const key = normalizeTextForMatch(name);
  if (key && !into.has(key)) into.set(key, name);
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
  BRACKET_HEADER_RE.lastIndex = 0;
  for (const match of text.matchAll(BRACKET_HEADER_RE)) collectMemberName(match[1] ?? "", members);
  if (members.size < 2) {
    members.clear();
    // Parse the label separately so long malformed whitespace cannot make adjacent regex groups backtrack.
    for (const line of text.split(/\r?\n/u)) {
      const colon = line.search(/[:：]/u);
      if (colon < 0) continue;
      const label = line.slice(0, colon).replace(/^[\s*_\-•>]+/u, "");
      if (!/^(?:full\s+name|name)[\s*_]*$/iu.test(label)) continue;
      const value = line
        .slice(colon + 1)
        .replace(/^[\s*_]+/u, "")
        .trimEnd();
      if (value.length <= 120) collectMemberName(value, members);
    }
  }
  if (cardNameKey) members.delete(cardNameKey);
  if (members.size < 2) return [];
  return [...members.values()].slice(0, MAX_CAST_MEMBERS);
}
