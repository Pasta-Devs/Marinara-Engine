import type { CharacterSearchData } from "./character-search";

type CharacterData = CharacterSearchData & {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  creator?: string;
  character_version?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  tags?: string[];
  alternate_greetings?: string[];
};

export type SortOption = "name-asc" | "name-desc" | "newest" | "oldest" | "favorites";

export type CharacterRow = {
  id: string;
  data: Partial<CharacterData>;
  comment?: string | null;
  avatarPath?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ParsedCharacterRow = CharacterRow & {
  parsed: Partial<CharacterData> & {
    extensions?: Record<string, unknown>;
  };
};

const CHARACTER_LIBRARY_SORT_SESSION_KEY = "marinara:character-library-sort";
const SORT_OPTIONS = ["name-asc", "name-desc", "newest", "oldest", "favorites"] as const satisfies SortOption[];

export function parseCharacterRow(char: CharacterRow): ParsedCharacterRow {
  return { ...char, parsed: (char.data as ParsedCharacterRow["parsed"]) ?? {} };
}

export function getText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getCharacterSummary(char: ParsedCharacterRow): string {
  const creatorNotes = getText(char.parsed.creator_notes);
  if (creatorNotes) return creatorNotes;

  const comment = getText(char.comment);
  if (comment) return comment;

  return "No creator notes yet.";
}

export function getCharacterMeta(char: ParsedCharacterRow): string | null {
  const parts: string[] = [];
  const creator = getText(char.parsed.creator);
  const version = getText(char.parsed.character_version);

  if (creator) parts.push(creator);
  if (version) parts.push(`v${version}`);

  return parts.join(" · ") || null;
}

export function truncateText(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength - 3).trimEnd()}...`;
}

export function gridColumnCount(width: number): number {
  if (width >= 1440) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

export function isSortOption(value: string | null): value is SortOption {
  return SORT_OPTIONS.includes(value as SortOption);
}

export function readSessionSort(): SortOption {
  if (typeof window === "undefined") return "name-asc";
  try {
    const storedSort = window.sessionStorage.getItem(CHARACTER_LIBRARY_SORT_SESSION_KEY);
    return isSortOption(storedSort) ? storedSort : "name-asc";
  } catch {
    return "name-asc";
  }
}

export function writeSessionSort(sort: SortOption): void {
  try {
    window.sessionStorage.setItem(CHARACTER_LIBRARY_SORT_SESSION_KEY, sort);
  } catch {
    // Session storage may be unavailable; the mounted control still works.
  }
}

export function getCharacterSections(char: ParsedCharacterRow): Array<{ title: string; content: string }> {
  return [
    { title: "Description", content: getText(char.parsed.description) },
    { title: "Personality", content: getText(char.parsed.personality) },
    { title: "Scenario", content: getText(char.parsed.scenario) },
    { title: "Opening Message", content: getText(char.parsed.first_mes) },
  ].filter((section) => section.content);
}
