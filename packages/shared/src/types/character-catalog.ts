export type CharacterCatalogEntry = {
  id: string;
  name: string;
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
  /** Matching cards per folder id, before the folder filter. */
  folderCounts: Record<string, number>;
};
