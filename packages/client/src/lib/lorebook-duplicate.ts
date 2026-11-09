import type { CreateLorebookInput, Lorebook, LorebookEntry, LorebookFolder } from "@marinara-engine/shared";
import { api } from "./api-client";

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

function remapLorebookEntryRelationships(
  relationships: Record<string, string> | null | undefined,
  entryIdMap: Map<string, string>,
) {
  const remapped: Record<string, string> = {};
  if (!relationships) return remapped;
  for (const [sourceEntryId, relationshipType] of Object.entries(relationships)) {
    const clonedEntryId = entryIdMap.get(sourceEntryId);
    if (clonedEntryId) remapped[clonedEntryId] = relationshipType;
  }
  return remapped;
}

/**
 * Copy a lorebook with its folders, entries and entry links. Shared by the classic panel and the
 * new layout's Lorebooks page. Returns the new lorebook's id.
 */
export async function duplicateLorebook(
  lorebook: Lorebook,
  create: (input: CreateLorebookInput) => Promise<{ id: string }>,
): Promise<string> {
  const [folders, entries] = await Promise.all([
    api.get<LorebookFolder[]>(`/lorebooks/${lorebook.id}/folders`),
    api.get<LorebookEntry[]>(`/lorebooks/${lorebook.id}/entries`),
  ]);
  const created = await create(buildLorebookDuplicateInput(lorebook));
  const createdId = created.id;
  const folderIdMap = new Map<string, string>();
  const pendingFolders = [...folders].sort((a, b) => a.order - b.order);

  while (pendingFolders.length > 0) {
    let createdInPass = false;
    for (let index = pendingFolders.length - 1; index >= 0; index--) {
      const folder = pendingFolders[index]!;
      const parentFolderId = folder.parentFolderId ? folderIdMap.get(folder.parentFolderId) : null;
      if (folder.parentFolderId && !parentFolderId) continue;
      const createdFolder = await api.post<LorebookFolder>(`/lorebooks/${createdId}/folders`, {
        name: folder.name,
        enabled: folder.enabled,
        parentFolderId,
        order: folder.order,
      });
      folderIdMap.set(folder.id, createdFolder.id);
      pendingFolders.splice(index, 1);
      createdInPass = true;
    }
    if (!createdInPass) throw new Error("Could not copy lorebook folders");
  }

  if (entries.length > 0) {
    const clonedEntries = entries.map((entry) => {
      const clone: Partial<LorebookEntry> = { ...entry };
      delete clone.id;
      delete clone.lorebookId;
      delete clone.createdAt;
      delete clone.updatedAt;
      delete clone.embedding;
      clone.folderId = entry.folderId ? (folderIdMap.get(entry.folderId) ?? null) : null;
      clone.relationships = {};
      return clone;
    });
    const createdEntries = await api.post<LorebookEntry[]>(`/lorebooks/${createdId}/entries/bulk`, {
      entries: clonedEntries,
    });
    const entryIdMap = new Map<string, string>();
    entries.forEach((entry, index) => {
      const createdEntry = createdEntries[index];
      if (createdEntry) entryIdMap.set(entry.id, createdEntry.id);
    });
    await Promise.all(
      entries.flatMap((entry, index) => {
        const createdEntry = createdEntries[index];
        if (!createdEntry) return [];
        const relationships = remapLorebookEntryRelationships(entry.relationships, entryIdMap);
        if (Object.keys(relationships).length === 0) return [];
        return [api.patch<LorebookEntry>(`/lorebooks/${createdId}/entries/${createdEntry.id}`, { relationships })];
      }),
    );
  }
  return createdId;
}
