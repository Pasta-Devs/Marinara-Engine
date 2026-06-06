import type { LorebookFolder } from "../../../../engine/contracts/types/lorebook";

type FolderTreeNode = Pick<LorebookFolder, "id" | "lorebookId" | "parentFolderId">;

type ReparentResult = { ok: true } | { ok: false; reason: string };

// Client-side mirror of the storage ancestry guard for editor affordances.
export function canReparentFolder(
  folders: FolderTreeNode[],
  folderId: string,
  newParentId: string | null,
): ReparentResult {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const folder = byId.get(folderId);
  if (!folder) return { ok: false, reason: "Folder not found." };

  if (newParentId === null) return { ok: true };
  if (newParentId === folderId) {
    return { ok: false, reason: "A folder cannot be its own parent." };
  }

  const newParent = byId.get(newParentId);
  if (!newParent) return { ok: false, reason: "Target parent folder not found." };
  if (newParent.lorebookId !== folder.lorebookId) {
    return { ok: false, reason: "A folder can only nest under a folder in the same lorebook." };
  }

  // Reject descendant moves; seen prevents malformed existing cycles from looping.
  const seen = new Set<string>();
  let current: FolderTreeNode | undefined = newParent;
  while (current && !seen.has(current.id)) {
    if (current.id === folderId) {
      return { ok: false, reason: "A folder cannot be nested inside one of its own subfolders." };
    }
    seen.add(current.id);
    current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
  }

  return { ok: true };
}

// Collapsing a folder hides its whole subtree from "select visible".
export function collectHiddenFolderIds(
  folders: Pick<LorebookFolder, "id" | "parentFolderId">[],
  collapsedFolderIds: ReadonlySet<string>,
): Set<string> {
  if (collapsedFolderIds.size === 0) return new Set();
  const childrenByParent = new Map<string, string[]>();
  for (const folder of folders) {
    const parentId = folder.parentFolderId;
    if (!parentId) continue;
    const siblings = childrenByParent.get(parentId);
    if (siblings) siblings.push(folder.id);
    else childrenByParent.set(parentId, [folder.id]);
  }
  const hidden = new Set<string>();
  const stack = Array.from(collapsedFolderIds);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (hidden.has(id)) continue;
    hidden.add(id);
    const children = childrenByParent.get(id);
    if (children) stack.push(...children);
  }
  return hidden;
}

type ForestNode = { id: string; parentFolderId: string | null; order: number };

// Render shape: sorted roots plus sorted child lists.
export type FolderForest<T extends ForestNode> = {
  roots: T[];
  childrenByParent: Map<string, T[]>;
};

export function buildFolderForest<T extends ForestNode>(folders: T[]): FolderForest<T> {
  const ids = new Set(folders.map((folder) => folder.id));
  const roots: T[] = [];
  const childrenByParent = new Map<string, T[]>();
  for (const folder of folders) {
    const parentId = folder.parentFolderId;
    // Dangling parents render at root so orphaned folders stay editable.
    if (parentId !== null && ids.has(parentId)) {
      const siblings = childrenByParent.get(parentId);
      if (siblings) siblings.push(folder);
      else childrenByParent.set(parentId, [folder]);
    } else {
      roots.push(folder);
    }
  }

  // Promote unreachable cycle members to roots and remove their cyclic child edge.
  const reachable = new Set<string>();
  const stack = roots.map((folder) => folder.id);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child.id);
  }
  for (const folder of folders) {
    if (reachable.has(folder.id)) continue;
    roots.push(folder);
    const parentId = folder.parentFolderId;
    if (parentId !== null) {
      const siblings = childrenByParent.get(parentId);
      if (siblings) {
        const remaining = siblings.filter((sibling) => sibling.id !== folder.id);
        if (remaining.length > 0) childrenByParent.set(parentId, remaining);
        else childrenByParent.delete(parentId);
      }
    }
  }

  const byOrder = (a: T, b: T) => a.order - b.order;
  roots.sort(byOrder);
  for (const siblings of childrenByParent.values()) siblings.sort(byOrder);
  return { roots, childrenByParent };
}
