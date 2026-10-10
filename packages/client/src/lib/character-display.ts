import type { AvatarCrop } from "@marinara-engine/shared";
import { normalizeAvatarCrop } from "@marinara-engine/shared";

export interface CharacterDisplayInfo {
  name: string;
  summary?: string | null;
  comment?: string | null;
  description?: string | null;
  tags?: string[];
  creator?: string | null;
  /** Normalized avatar crop from `extensions.avatarCrop` (either shape, or
   *  null when unset/malformed). Populated by parseCharacterDisplayData so
   *  consumers never re-parse the character data for the crop. */
  avatarCrop?: AvatarCrop | null;
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

export function characterMatchesSearch(character: CharacterDisplayInfo | null | undefined, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    ...getCharacterLookupAliases(character),
    character?.description ?? "",
    character?.creator ?? "",
    ...(character?.tags ?? []),
  ].some((value) => value.toLowerCase().includes(query));
}

export function parseCharacterDisplayData(raw: { data: unknown; comment?: string | null }): CharacterDisplayInfo {
  const comment = typeof raw.comment === "string" ? raw.comment.trim() : "";

  let record: Record<string, unknown> | null = null;
  try {
    const parsed = typeof raw.data === "string" ? JSON.parse(raw.data) : raw.data;
    record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    record = null;
  }
  const name = typeof record?.name === "string" && record.name.trim() ? record.name.trim() : "Unknown";
  const summary = typeof record?.summary === "string" ? record.summary.trim() : "";
  const description = typeof record?.description === "string" ? record.description : "";
  const creator = typeof record?.creator === "string" ? record.creator : "";
  const tags = Array.isArray(record?.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];
  const extensions = record?.extensions;
  const rawAvatarCrop =
    extensions && typeof extensions === "object" && !Array.isArray(extensions)
      ? (extensions as Record<string, unknown>).avatarCrop
      : undefined;
  return { name, summary, comment, description, tags, creator, avatarCrop: normalizeAvatarCrop(rawAvatarCrop) };
}

export function getCharacterDisplayIdentity(raw: { data: unknown; comment?: string | null }): string {
  return parseCharacterDisplayData(raw).name;
}
