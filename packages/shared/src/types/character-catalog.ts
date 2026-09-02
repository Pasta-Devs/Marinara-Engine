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
};
