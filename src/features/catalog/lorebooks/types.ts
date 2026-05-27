export type LorebookCategory = "world" | "character" | "npc" | "spellbook" | "uncategorized";

export interface Lorebook {
  id: string;
  name: string;
  description: string;
  category: LorebookCategory;
  enabled: boolean;
  excludeFromVectorization?: boolean;
  isGlobal?: boolean;
  characterId?: string | null;
  characterIds?: string[];
  personaId?: string | null;
  personaIds?: string[];
  chatId?: string | null;
  tags?: string[] | string | null;
  scanDepth: number;
  tokenBudget: number;
  recursiveScanning: boolean;
  maxRecursionDepth?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface LorebookEntry {
  id: string;
  lorebookId: string;
  folderId?: string | null;
  name: string;
  content: string;
  keys: string[] | string;
  secondaryKeys?: string[] | string | null;
  enabled: boolean;
  insertionOrder: number;
  tokenCount?: number | null;
  createdAt?: string | null;
}

export interface LorebookFolder {
  id: string;
  lorebookId: string;
  name: string;
  sortOrder: number;
}
