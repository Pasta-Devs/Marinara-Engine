// ──────────────────────────────────────────────
// Card library sources: one adapter per library kind (characters, personas, lorebooks).
// Each turns its resource rows into the shared LibraryCard shape the Library view renders,
// so the view itself never branches on what it is showing.
// ──────────────────────────────────────────────
import { useMemo } from "react";
import {
  estimatePersonaTokens,
  normalizeAvatarCrop,
  normalizeNameAliases,
  type AvatarCrop,
  type CharacterCatalogEntry,
  type CharacterData,
  type Persona,
} from "@marinara-engine/shared";
import {
  flattenCharacterPages,
  flattenPersonaPages,
  useCharacter,
  useCharacterPages,
  usePersonaPages,
} from "../../hooks/use-characters";
import { flattenLorebookPages, useLorebookPages, type LorebookListItem } from "../../hooks/use-lorebooks";
import { getCharacterTitle } from "../../lib/character-display";
import { formatCardLibraryMeta, getCardLibrarySummary } from "../../lib/card-library-search";
import { estimateCharacterCardTokens } from "../../lib/character-token-count";
import { resolveSelfCardAssets } from "../../lib/card-asset-links";

export type LibrarySection = { title: string; content: string };

export type LibraryCard = {
  id: string;
  name: string;
  aliases: string[];
  title: string | null;
  meta: string | null;
  summary: string;
  avatarPath: string | null;
  avatarCrop?: AvatarCrop;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  /** Absent for kinds without a card-text estimate (lorebooks show their entry count instead). */
  tokenEstimate?: number;
  /** Lorebooks: number of entries, shown in place of the token estimate. */
  entryCount?: number;
  favorite: boolean;
  /** Lorebooks: globally enabled. */
  active?: boolean;
  creatorNotes: string;
  hasExplicitSummary: boolean;
  sections: LibrarySection[];
};

export interface CardLibrarySource {
  cards: LibraryCard[];
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => void;
  /** Server total when the kind reports one; the load-more button then says "N of M". */
  total: number | null;
}

interface SourceOptions {
  enabled: boolean;
  search: string;
  sort: string;
}

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// ── Characters ──

type ParsedCharacterRow = Pick<
  CharacterCatalogEntry,
  "id" | "comment" | "avatarPath" | "createdAt" | "updatedAt" | "tokenEstimate"
> & {
  parsed: Partial<CharacterData> & {
    extensions?: Record<string, unknown>;
  };
};

function parseCharacterRow(char: CharacterCatalogEntry): ParsedCharacterRow {
  try {
    const parsed = {
      name: char.name,
      summary: char.explicitSummary,
      description: char.description,
      personality: char.personality,
      scenario: char.scenario,
      first_mes: char.firstMessage,
      creator_notes: char.creatorNotes,
      tags: char.tags,
      creator: char.creator,
      character_version: char.version,
      extensions: {
        fav: char.favorite,
        avatarCrop: char.avatarCrop,
        nameColor: char.nameColor,
        nameAliases: char.nameAliases,
      },
    };
    return { ...char, parsed: parsed as unknown as ParsedCharacterRow["parsed"] };
  } catch {
    return { ...char, parsed: { name: "Unknown", description: "" } };
  }
}

function getCharacterSections(char: ParsedCharacterRow): LibrarySection[] {
  // card://self gallery images, such as greeting images saved locally (#7221), show from this character's gallery.
  return [
    { title: "chat.settings.inlineEditor.fields.description", content: getText(char.parsed.description) },
    { title: "chat.settings.inlineEditor.fields.personality", content: getText(char.parsed.personality) },
    { title: "chat.settings.inlineEditor.fields.scenario", content: getText(char.parsed.scenario) },
    { title: "ui.cardLibrary.sections.openingMessage", content: getText(char.parsed.first_mes) },
  ]
    .map((section) => ({ ...section, content: resolveSelfCardAssets(section.content, char.id) }))
    .filter((section) => section.content);
}

function toCharacterLibraryCard(char: ParsedCharacterRow): LibraryCard {
  const name = getText(char.parsed.name) || "Unnamed";
  return {
    id: char.id,
    name,
    aliases: normalizeNameAliases(char.parsed.extensions?.nameAliases),
    title: getCharacterTitle({ name, comment: char.comment }),
    meta: formatCardLibraryMeta(char.parsed.creator, char.parsed.character_version),
    summary: getCardLibrarySummary([
      char.parsed.summary,
      char.parsed.creator_notes,
      char.parsed.description,
      char.parsed.personality,
    ]),
    avatarPath: char.avatarPath,
    avatarCrop: normalizeAvatarCrop(char.parsed.extensions?.avatarCrop) ?? undefined,
    createdAt: char.createdAt,
    updatedAt: char.updatedAt,
    tags: (Array.isArray(char.parsed.tags) ? char.parsed.tags : []).filter(
      (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
    ),
    tokenEstimate: char.tokenEstimate ?? estimateCharacterCardTokens(char.parsed),
    favorite: !!char.parsed.extensions?.fav,
    creatorNotes: getText(char.parsed.creator_notes),
    hasExplicitSummary: Boolean(getText(char.parsed.summary)),
    sections: getCharacterSections(char),
  };
}

/** `initialId`: a home shortcut can target a card outside the loaded page; it is fetched on its own and appended. */
export function useCharacterLibrarySource({
  enabled,
  search,
  sort,
  initialId,
}: SourceOptions & { initialId: string | null }): CardLibrarySource {
  const pages = useCharacterPages({ enabled, search, sort });
  const initialCharacter = useCharacter(enabled ? initialId : null);
  const cards = useMemo(() => {
    if (!enabled) return [];
    const rows = (flattenCharacterPages(pages.data) as unknown as CharacterCatalogEntry[])
      .map(parseCharacterRow)
      .map(toCharacterLibraryCard);
    // Reuse the single-card query instead of loading every library page to reach it.
    const initial = initialCharacter.data as (Omit<ParsedCharacterRow, "parsed"> & { data: string }) | undefined;
    if (initial && !rows.some((card) => card.id === initial.id)) {
      try {
        rows.push(toCharacterLibraryCard({ ...initial, parsed: JSON.parse(initial.data) }));
      } catch {
        // Keep the normal library usable if the target contains malformed data.
      }
    }
    return rows;
  }, [enabled, initialCharacter.data, pages.data]);
  return {
    cards,
    isLoading: pages.isLoading || initialCharacter.isLoading,
    hasNextPage: !!pages.hasNextPage,
    isFetchingNextPage: pages.isFetchingNextPage,
    isFetchNextPageError: pages.isFetchNextPageError,
    fetchNextPage: () => void pages.fetchNextPage(),
    total: pages.data?.pages[0]?.total ?? null,
  };
}

// ── Personas ──

function toPersonaLibraryCard(persona: Persona): LibraryCard {
  return {
    id: persona.id,
    name: getText(persona.name) || "Unnamed",
    aliases: persona.nameAliases,
    title: getText(persona.comment) || null,
    meta: formatCardLibraryMeta(persona.creator, persona.personaVersion),
    summary: getCardLibrarySummary([
      persona.summary,
      persona.creatorNotes,
      persona.description,
      persona.personality,
      persona.backstory,
    ]),
    avatarPath: persona.avatarPath,
    avatarCrop: persona.avatarCrop ?? undefined,
    createdAt: persona.createdAt,
    updatedAt: persona.updatedAt,
    tags: persona.tags.filter((tag) => tag.trim().length > 0),
    tokenEstimate: estimatePersonaTokens(persona),
    favorite: false,
    creatorNotes: getText(persona.creatorNotes),
    hasExplicitSummary: Boolean(getText(persona.summary)),
    sections: [
      { title: "chat.settings.inlineEditor.fields.description", content: getText(persona.description) },
      { title: "chat.settings.inlineEditor.fields.personality", content: getText(persona.personality) },
      { title: "chat.settings.inlineEditor.fields.scenario", content: getText(persona.scenario) },
      { title: "chat.settings.inlineEditor.fields.backstory", content: getText(persona.backstory) },
      { title: "chat.settings.inlineEditor.fields.appearance", content: getText(persona.appearance) },
      { title: "chat.settings.inlineEditor.fields.exampleDialogue", content: getText(persona.mes_example) },
    ].filter((section) => section.content),
  };
}

export function usePersonaLibrarySource({ enabled, search, sort }: SourceOptions): CardLibrarySource {
  const pages = usePersonaPages({ enabled, search, sort });
  const cards = useMemo(
    () => (enabled ? flattenPersonaPages(pages.data).map(toPersonaLibraryCard) : []),
    [enabled, pages.data],
  );
  return {
    cards,
    isLoading: pages.isLoading,
    hasNextPage: !!pages.hasNextPage,
    isFetchingNextPage: pages.isFetchingNextPage,
    isFetchNextPageError: pages.isFetchNextPageError,
    fetchNextPage: () => void pages.fetchNextPage(),
    total: null,
  };
}

// ── Lorebooks ──

function toLorebookLibraryCard(lorebook: LorebookListItem): LibraryCard {
  const description = getText(lorebook.description);
  const owners = [...(lorebook.characterNames ?? []), ...(lorebook.personaNames ?? [])].filter(Boolean);
  return {
    id: lorebook.id,
    name: getText(lorebook.name) || "Unnamed",
    aliases: [],
    // The character/persona a lorebook belongs to, as the Lorebooks panel shows under its name.
    title: owners.length > 0 ? owners.join(", ") : null,
    meta: null,
    summary: getCardLibrarySummary([description]),
    avatarPath: lorebook.imagePath,
    avatarCrop: normalizeAvatarCrop(lorebook.imageCrop) ?? undefined,
    createdAt: lorebook.createdAt,
    updatedAt: lorebook.updatedAt,
    tags: lorebook.tags.filter((tag) => tag.trim().length > 0),
    entryCount: lorebook.entryCount ?? 0,
    tokenEstimate: lorebook.tokenEstimate,
    favorite: false,
    active: lorebook.enabled,
    creatorNotes: "",
    hasExplicitSummary: false,
    sections: description ? [{ title: "chat.settings.inlineEditor.fields.description", content: description }] : [],
  };
}

export function useLorebookLibrarySource({ enabled, search, sort }: SourceOptions): CardLibrarySource {
  const pages = useLorebookPages({ enabled, search, sort });
  const cards = useMemo(
    () => (enabled ? flattenLorebookPages(pages.data).map(toLorebookLibraryCard) : []),
    [enabled, pages.data],
  );
  return {
    cards,
    isLoading: pages.isLoading,
    hasNextPage: !!pages.hasNextPage,
    isFetchingNextPage: pages.isFetchingNextPage,
    isFetchNextPageError: pages.isFetchNextPageError,
    fetchNextPage: () => void pages.fetchNextPage(),
    // Lorebook pages carry no total.
    total: null,
  };
}
