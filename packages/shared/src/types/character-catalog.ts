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
