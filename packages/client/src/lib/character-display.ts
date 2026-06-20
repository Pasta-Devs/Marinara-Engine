export interface CharacterDisplayInfo {
  name: string;
  comment?: string | null;
}

const LOOKUP_ALIAS_SEPARATOR = /\s+(?:-|\/|\||:|\u2013|\u2014)\s+/;
const LOOKUP_ALIAS_PARENS = /\(([^)]{1,96})\)|\[([^\]]{1,96})\]/g;
const LOOKUP_ALIAS_EDGE_PUNCTUATION = /^[\s"'([{]+|[\s"')\]}.,:;]+$/g;

function addLookupAlias(aliases: string[], seen: Set<string>, value: string | null | undefined) {
  const alias = (value ?? "").replace(/\s+/g, " ").replace(LOOKUP_ALIAS_EDGE_PUNCTUATION, "").trim();
  if (!alias || alias.length > 96) return;
  const key = alias.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  aliases.push(alias);
}

function addLeadingLookupAlias(aliases: string[], seen: Set<string>, value: string | null | undefined) {
  const [leadingAlias] = (value ?? "").split(LOOKUP_ALIAS_SEPARATOR);
  addLookupAlias(aliases, seen, leadingAlias);
}

export function getCharacterTitle(character: CharacterDisplayInfo | null | undefined): string | null {
  const title = typeof character?.comment === "string" ? character.comment.trim() : "";
  return title || null;
}

export function getCharacterLookupAliases(character: CharacterDisplayInfo | null | undefined): string[] {
  const aliases: string[] = [];
  const seen = new Set<string>();

  addLookupAlias(aliases, seen, character?.name);

  const title = getCharacterTitle(character);
  if (!title) return aliases;

  addLookupAlias(aliases, seen, title);

  for (const match of title.matchAll(LOOKUP_ALIAS_PARENS)) {
    addLookupAlias(aliases, seen, match[1] ?? match[2]);
  }

  const withoutParenthetical = title.replace(LOOKUP_ALIAS_PARENS, " ");
  addLookupAlias(aliases, seen, withoutParenthetical);
  addLeadingLookupAlias(aliases, seen, withoutParenthetical);

  return aliases;
}

export function parseCharacterDisplayData(raw: { data: unknown; comment?: string | null }): CharacterDisplayInfo {
  const comment = typeof raw.comment === "string" ? raw.comment.trim() : "";

  try {
    const parsed = typeof raw.data === "string" ? JSON.parse(raw.data) : raw.data;
    const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    const name = typeof record?.name === "string" && record.name.trim() ? record.name.trim() : "Unknown";
    return { name, comment };
  } catch {
    return { name: "Unknown", comment };
  }
}
