import {
  normalizeAvatarCrop,
  projectCharacterForEntitySummary,
  projectPersonaForEntitySummary,
  type AvatarCrop,
  type CharacterData,
  type EntitySummarySource,
} from "@marinara-engine/shared";
import { getCharacterTitle } from "../character-display";
import { formatCardLibraryMeta, getCardLibrarySummary } from "../card-library-search";
import { estimateCharacterCardTokens } from "../character-token-count";

export type LibraryResourceKind = "character" | "persona";

export type CharacterLibraryRow = {
  id: string;
  data: string | (Partial<CharacterData> & { extensions?: Record<string, unknown> });
  comment?: string | null;
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
  entitySummaryGeneratedAt?: string | null;
  entitySummarySource?: EntitySummarySource | null;
  entitySummaryContentHash?: string | null;
  entitySummaryProjectionVersion?: number | null;
};

export type PersonaLibraryRow = {
  id: string;
  name: string;
  comment?: string | null;
  creator?: string | null;
  personaVersion?: string | null;
  creatorNotes?: string | null;
  description?: string | null;
  personality?: string | null;
  scenario?: string | null;
  backstory?: string | null;
  appearance?: string | null;
  entitySummary?: string | null;
  entitySummaryGeneratedAt?: string | null;
  entitySummarySource?: EntitySummarySource | null;
  entitySummaryContentHash?: string | null;
  entitySummaryProjectionVersion?: number | null;
  avatarPath: string | null;
  avatarCrop?: string | AvatarCrop | null;
  isActive?: boolean | string;
  tags?: string | string[] | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryItemSection = { title: string; content: string };

export type LibraryItem = {
  id: string;
  kind: LibraryResourceKind;
  name: string;
  title: string | null;
  meta: string | null;
  summary: string;
  avatarPath: string | null;
  avatarCrop?: AvatarCrop;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  tokenEstimate: number;
  favorite: boolean;
  active: boolean;
  creatorNotes: string;
  sections: LibraryItemSection[];
  summaryStatusInput: {
    entitySummary: string;
    entitySummarySource: EntitySummarySource | null;
    entitySummaryContentHash: string | null;
    entitySummaryProjectionVersion: number | null;
    projection: unknown;
  };
};

type ParsedCharacterLibraryRow = CharacterLibraryRow & {
  parsed: Partial<CharacterData> & { extensions?: Record<string, unknown> };
};

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCharacterRow(character: CharacterLibraryRow): ParsedCharacterLibraryRow {
  try {
    const parsed = typeof character.data === "string" ? JSON.parse(character.data) : character.data;
    return { ...character, parsed: (parsed as ParsedCharacterLibraryRow["parsed"]) ?? {} };
  } catch {
    return { ...character, parsed: { name: "Unknown", description: "" } };
  }
}

function getCharacterTags(character: ParsedCharacterLibraryRow): string[] {
  return (Array.isArray(character.parsed.tags) ? character.parsed.tags : []).filter(
    (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
  );
}

function getPersonaTags(persona: PersonaLibraryRow): string[] {
  if (Array.isArray(persona.tags)) {
    return persona.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
  }
  if (!persona.tags) return [];
  try {
    const parsed = JSON.parse(persona.tags);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function getCharacterSections(character: ParsedCharacterLibraryRow): LibraryItemSection[] {
  return [
    { title: "Description", content: getText(character.parsed.description) },
    { title: "Personality", content: getText(character.parsed.personality) },
    { title: "Scenario", content: getText(character.parsed.scenario) },
    { title: "Opening Message", content: getText(character.parsed.first_mes) },
  ].filter((section) => section.content);
}

function getPersonaSections(persona: PersonaLibraryRow): LibraryItemSection[] {
  return [
    { title: "Description", content: getText(persona.description) },
    { title: "Personality", content: getText(persona.personality) },
    { title: "Scenario", content: getText(persona.scenario) },
    { title: "Backstory", content: getText(persona.backstory) },
    { title: "Appearance", content: getText(persona.appearance) },
  ].filter((section) => section.content);
}

function estimatePersonaTokens(persona: PersonaLibraryRow) {
  return Math.ceil(
    [persona.description, persona.personality, persona.scenario, persona.backstory, persona.appearance]
      .map(getText)
      .join("").length / 4,
  );
}

export function characterToLibraryItem(characterRow: CharacterLibraryRow): LibraryItem {
  const character = parseCharacterRow(characterRow);
  const name = getText(character.parsed.name) || "Unnamed";
  return {
    id: character.id,
    kind: "character",
    name,
    title: getCharacterTitle({ name, comment: character.comment }),
    meta: formatCardLibraryMeta(character.parsed.creator, character.parsed.character_version),
    summary: getCardLibrarySummary([
      character.parsed.extensions?.entitySummary,
      character.parsed.creator_notes,
      character.parsed.description,
      character.parsed.personality,
    ]),
    avatarPath: character.avatarPath,
    avatarCrop: normalizeAvatarCrop(character.parsed.extensions?.avatarCrop) ?? undefined,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    tags: getCharacterTags(character),
    tokenEstimate: estimateCharacterCardTokens(character.parsed),
    favorite: !!character.parsed.extensions?.fav,
    active: false,
    creatorNotes: getText(character.parsed.creator_notes),
    sections: getCharacterSections(character),
    summaryStatusInput: {
      entitySummary: getText(character.parsed.extensions?.entitySummary),
      entitySummarySource:
        character.parsed.extensions?.entitySummarySource === "ai" ||
        character.parsed.extensions?.entitySummarySource === "manual"
          ? character.parsed.extensions.entitySummarySource
          : null,
      entitySummaryContentHash: getText(character.parsed.extensions?.entitySummaryContentHash) || null,
      entitySummaryProjectionVersion:
        typeof character.parsed.extensions?.entitySummaryProjectionVersion === "number"
          ? character.parsed.extensions.entitySummaryProjectionVersion
          : null,
      projection: projectCharacterForEntitySummary(character.parsed as CharacterData),
    },
  };
}

export function personaToLibraryItem(persona: PersonaLibraryRow): LibraryItem {
  return {
    id: persona.id,
    kind: "persona",
    name: getText(persona.name) || "Unnamed",
    title: getText(persona.comment) || null,
    meta: formatCardLibraryMeta(persona.creator, persona.personaVersion),
    summary: getCardLibrarySummary([
      persona.entitySummary,
      persona.creatorNotes,
      persona.description,
      persona.personality,
      persona.backstory,
    ]),
    avatarPath: persona.avatarPath,
    avatarCrop: normalizeAvatarCrop(persona.avatarCrop) ?? undefined,
    createdAt: persona.createdAt,
    updatedAt: persona.updatedAt,
    tags: getPersonaTags(persona),
    tokenEstimate: estimatePersonaTokens(persona),
    favorite: false,
    active: persona.isActive === true || persona.isActive === "true",
    creatorNotes: getText(persona.creatorNotes),
    sections: getPersonaSections(persona),
    summaryStatusInput: {
      entitySummary: getText(persona.entitySummary),
      entitySummarySource: persona.entitySummarySource ?? null,
      entitySummaryContentHash: persona.entitySummaryContentHash ?? null,
      entitySummaryProjectionVersion: persona.entitySummaryProjectionVersion ?? null,
      projection: projectPersonaForEntitySummary({
        ...persona,
        tags: getPersonaTags(persona),
      }),
    },
  };
}
