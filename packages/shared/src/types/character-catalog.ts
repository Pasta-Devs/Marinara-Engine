export type CharacterCatalogEntry = {
  id: string;
  name: string;
  /** Other names (`extensions.nameAliases`), normalized. */
  nameAliases: string[];
  comment: string;
  creator: string;
  version: string;
  tags: string[];
  favorite: boolean;
  summary: string;
  explicitSummary: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  creatorNotes: string;
  tokenEstimate: number;
  nameColor: string | null;
  /** The card has interactive onboarding the player will be offered. */
  hasOnboarding: boolean;
  /** The card carries an embedded lorebook (character_book entries or the embed pointer). */
  hasEmbeddedLorebook?: boolean;
  avatarPath: string | null;
  avatarCrop: unknown;
  createdAt: string;
  updatedAt: string;
};

export type CharacterCatalogPage = {
  items: CharacterCatalogEntry[];
  limit: number;
  offset: number;
  hasMore: boolean;
  catalogGeneration: number;
  /** Matching cards across all pages. */
  total: number;
  /** Folders that hold a matching favourite, before the folder filter. */
  favoriteFolderIds: string[];
  /** Under a size sort: each folder's total estimated tokens over matching cards, before the folder filter. */
  folderTokenTotals?: Record<string, number>;
};

/** List-only rows; full card text remains available through the default catalog view. */
export type CharacterCatalogSummaryEntry = Omit<
  CharacterCatalogEntry,
  "explicitSummary" | "description" | "personality" | "scenario" | "firstMessage" | "creatorNotes"
> & {
  cardSpec: string;
  cardSpecVersion: string;
};

export type CharacterCatalogSummaryPage = Omit<CharacterCatalogPage, "items"> & {
  items: CharacterCatalogSummaryEntry[];
};

/** Every tag with its card count, plus the untagged and favourite counts (`/characters/catalog/tag-counts`). */
export type CharacterCatalogTagCounts = {
  tags: Array<{ tag: string; count: number }>;
  untagged: number;
  favorites: number;
  /** Cards in the library (Professor Mari left out unless built-ins are asked for). */
  total: number;
};
