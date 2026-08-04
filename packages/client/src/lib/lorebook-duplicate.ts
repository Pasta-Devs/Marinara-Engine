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
  for (const [sourceEntryId, relationshipType] of Object.entries(relationships ?? {})) {
    const clonedEntryId = entryIdMap.get(sourceEntryId);
    if (clonedEntryId) remapped[clonedEntryId] = relationshipType;
  }
  return remapped;
}

export async function duplicateLorebook(
  lorebook: Lorebook,
  createLorebook: (input: CreateLorebookInput) => Promise<Lorebook>,
) {
  const [folders, entries] = await Promise.all([
    api.get<LorebookFolder[]>(`/lorebooks/${lorebook.id}/folders`),
    api.get<LorebookEntry[]>(`/lorebooks/${lorebook.id}/entries`),
  ]);
  const created = await createLorebook(buildLorebookDuplicateInput(lorebook));
  const folderIdMap = new Map<string, string>();
  const pendingFolders = [...folders].sort((left, right) => left.order - right.order);

  while (pendingFolders.length > 0) {
    let createdInPass = false;
    for (let index = pendingFolders.length - 1; index >= 0; index--) {
      const folder = pendingFolders[index];
      const parentFolderId = folder.parentFolderId ? folderIdMap.get(folder.parentFolderId) : null;
      if (folder.parentFolderId && !parentFolderId) continue;
      const createdFolder = await api.post<LorebookFolder>(`/lorebooks/${created.id}/folders`, {
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
  const createdEntries =
    clonedEntries.length > 0
      ? await api.post<LorebookEntry[]>(`/lorebooks/${created.id}/entries/bulk`, { entries: clonedEntries })
      : [];
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
      return [api.patch(`/lorebooks/${created.id}/entries/${createdEntry.id}`, { relationships })];
    }),
  );
  if (!lorebook.entitySummary.trim()) return created;
  return api.patch<Lorebook>(`/lorebooks/${created.id}`, { entitySummary: lorebook.entitySummary });
}
