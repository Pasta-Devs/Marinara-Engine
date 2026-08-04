import type { Lorebook, LorebookCategory } from "@marinara-engine/shared";
import type { LorebookListItem } from "../../hooks/use-lorebooks";
import type { EntitySummaryStatusInput } from "../entity-summary-status";

export interface LorebookResource {
  id: string;
  name: string;
  description: string;
  summary: string;
  category: LorebookCategory;
  coverPath: string | null;
  enabled: boolean;
  isGlobal: boolean;
  chatId: string | null;
  scopeMode: Lorebook["scope"]["mode"];
  tokenBudget: number;
  entryLimit: number;
  tags: string[];
  characterNames: string[];
  personaNames: string[];
  createdAt: string;
  updatedAt: string;
  summaryStatusInput: EntitySummaryStatusInput;
  source: LorebookListItem;
}

function linkedNames(names: string[] | undefined, ids: string[], legacyId: string | null) {
  if (names?.length) return names;
  return Array.from(new Set([...ids, legacyId].filter((id): id is string => Boolean(id))));
}

export function lorebookToResource(lorebook: LorebookListItem): LorebookResource {
  return {
    id: lorebook.id,
    name: lorebook.name,
    description: lorebook.description,
    summary: lorebook.entitySummary || lorebook.description,
    category: lorebook.category,
    coverPath: lorebook.imagePath,
    enabled: lorebook.enabled,
    isGlobal: lorebook.isGlobal,
    chatId: lorebook.chatId,
    scopeMode: lorebook.scope.mode,
    tokenBudget: lorebook.tokenBudget,
    entryLimit: lorebook.entryLimit,
    tags: Array.isArray(lorebook.tags) ? lorebook.tags : [],
    characterNames: linkedNames(lorebook.characterNames, lorebook.characterIds, lorebook.characterId),
    personaNames: linkedNames(lorebook.personaNames, lorebook.personaIds, lorebook.personaId),
    createdAt: lorebook.createdAt,
    updatedAt: lorebook.updatedAt,
    summaryStatusInput: {
      entitySummary: lorebook.entitySummary,
      entitySummarySource: lorebook.entitySummarySource,
      entitySummaryContentHash: lorebook.entitySummaryContentHash,
      entitySummaryProjectionVersion: lorebook.entitySummaryProjectionVersion,
      currentContentHash: lorebook.entitySummaryCurrentContentHash,
    },
    source: lorebook,
  };
}

export function isLorebookActiveForChat(
  lorebook: LorebookListItem,
  context: {
    lorebookIds: string[];
    characterIds: string[];
    personaId: string | null;
    chatId: string | null;
  },
) {
  if (!lorebook.enabled) return false;
  const characterIds = Array.from(
    new Set([...lorebook.characterIds, lorebook.characterId].filter((id): id is string => Boolean(id))),
  );
  const personaIds = Array.from(
    new Set([...lorebook.personaIds, lorebook.personaId].filter((id): id is string => Boolean(id))),
  );
  return (
    lorebook.isGlobal ||
    context.lorebookIds.includes(lorebook.id) ||
    characterIds.some((id) => context.characterIds.includes(id)) ||
    personaIds.includes(context.personaId ?? "") ||
    Boolean(lorebook.chatId && lorebook.chatId === context.chatId)
  );
}
