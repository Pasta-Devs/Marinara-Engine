import type { CreateLorebookInput, Lorebook } from "@marinara-engine/shared";

function canonicalLinkedIds(ids: string[], legacyId: string | null) {
  return Array.from(new Set([...ids, legacyId].filter((id): id is string => Boolean(id))));
}

export function buildLorebookDuplicateInput(lorebook: Lorebook): CreateLorebookInput {
  return {
    name: `${lorebook.name} (Copy)`,
    description: lorebook.description,
    category: lorebook.category,
    imagePath: lorebook.imagePath,
    scanDepth: lorebook.scanDepth,
    tokenBudget: lorebook.tokenBudget,
    entryLimit: lorebook.entryLimit,
    recursiveScanning: lorebook.recursiveScanning,
    maxRecursionDepth: lorebook.maxRecursionDepth,
    excludeFromVectorization: lorebook.excludeFromVectorization,
    vectorQueryDepth: lorebook.vectorQueryDepth,
    vectorIncludeAssistant: lorebook.vectorIncludeAssistant ?? false,
    vectorScoreThreshold: lorebook.vectorScoreThreshold,
    vectorMaxResults: lorebook.vectorMaxResults,
    characterIds: canonicalLinkedIds(lorebook.characterIds, lorebook.characterId),
    personaIds: canonicalLinkedIds(lorebook.personaIds, lorebook.personaId),
    chatId: lorebook.chatId,
    isGlobal: lorebook.isGlobal,
    enabled: lorebook.enabled,
    scope: lorebook.scope,
    tags: lorebook.tags,
    generatedBy: lorebook.generatedBy,
    sourceAgentId: lorebook.sourceAgentId,
  };
}
