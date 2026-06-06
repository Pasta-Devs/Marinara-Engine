import type { LorebookFolder } from "../../../../engine/contracts/types/lorebook";

/** The folder fields the tree logic needs. Callers pass full `LorebookFolder`s. */
type FolderTreeNode = Pick<LorebookFolder, "id" | "lorebookId" | "parentFolderId">;

type ReparentResult = { ok: true } | { ok: false; reason: string };

/**
 * Decide whether `folderId` may be re-parented under `newParentId`.
 *
 * Rejects self-parenting, a parent in a different lorebook, and any move that
 * would create a cycle (nesting a folder inside one of its own descendants).
 * Moving to the root (`newParentId === null`) is always allowed.
 *
 * This is the write-time guard for nested folders. It runs client-side because
 * the lorebook-folder collection is stored generically with no server-side
 * field validation — matching how every other lorebook edit is validated. The
 * activation scanner additionally resolves disabled ancestors and guards
 * against cycles at read time, so a malformed parent that slips in via import
 * or a direct write can never hang generation.
 */
export function canReparentFolder(
  folders: FolderTreeNode[],
  folderId: string,
  newParentId: string | null,
): ReparentResult {
  if (newParentId === null) return { ok: true };
  if (newParentId === folderId) {
    return { ok: false, reason: "A folder cannot be its own parent." };
  }

  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const folder = byId.get(folderId);
  const newParent = byId.get(newParentId);
  if (!folder) return { ok: false, reason: "Folder not found." };
  if (!newParent) return { ok: false, reason: "Target parent folder not found." };
  if (newParent.lorebookId !== folder.lorebookId) {
    return { ok: false, reason: "A folder can only nest under a folder in the same lorebook." };
  }

  // Walk up from the target parent; reaching the folder itself means the move
  // would nest the folder inside its own subtree (a cycle). The `seen` guard
  // keeps a pre-existing malformed cycle from looping forever.
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

/**
 * Folder ids whose entries are hidden in the tree because the folder is
 * collapsed OR sits inside a collapsed ancestor. Collapsing a folder hides its
 * whole subtree, so a descendant of a collapsed folder counts as hidden even if
 * it is itself expanded. Used so "select all visible" never picks up entries the
 * user cannot actually see.
 */
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
    if (hidden.has(id)) continue; // also guards against malformed parent cycles
    hidden.add(id);
    const children = childrenByParent.get(id);
    if (children) stack.push(...children);
  }
  return hidden;
}

/** The folder fields the forest builder needs. Callers pass full `LorebookFolder`s. */
type ForestNode = { id: string; parentFolderId: string | null; order: number };

export type FolderForest<T extends ForestNode> = {
  /** Top-level folders (no parent, or a parent that no longer exists), sorted by `order`. */
  roots: T[];
  /** Direct children of each folder id, sorted by `order`. */
  childrenByParent: Map<string, T[]>;
};

/**
 * Group folders into a render-ready forest: top-level `roots` plus a
 * `childrenByParent` lookup, each list sorted by `order`.
 *
 * A folder whose `parentFolderId` is null OR points to a folder that no longer
 * exists is treated as a root. That dangling-parent fallback is what promotes a
 * deleted folder's children back to the top level — mirroring how an entry
 * whose folder is gone falls back to root — so deleting a parent needs no
 * cascade write.
 *
 * Generic over the folder shape so the editor gets full `LorebookFolder`s back.
 * Cycles cannot be created through the UI (`canReparentFolder`) or the storage
 * write path (`validate_lorebook_folder_*`); should malformed import data still
 * introduce one, its members are promoted to `roots` so they stay visible and
 * repairable, and the recursive renderer's visited set keeps a bad parent chain
 * from looping the tree.
 */
export function buildFolderForest<T extends ForestNode>(folders: T[]): FolderForest<T> {
  const ids = new Set(folders.map((folder) => folder.id));
  const roots: T[] = [];
  const childrenByParent = new Map<string, T[]>();
  for (const folder of folders) {
    const parentId = folder.parentFolderId;
    if (parentId !== null && ids.has(parentId)) {
      const siblings = childrenByParent.get(parentId);
      if (siblings) siblings.push(folder);
      else childrenByParent.set(parentId, [folder]);
    } else {
      roots.push(folder);
    }
  }

  // Promote folders unreachable from any root — i.e. trapped in a parent cycle
  // from malformed data (A→B→A) — up to the roots so they stay visible and
  // repairable instead of silently vanishing. The write path rejects cycles, so
  // this only matters for pre-existing or imported bad data; the recursive
  // renderer's own visited guard keeps the promoted cycle from looping.
  const reachable = new Set<string>();
  const stack = roots.map((folder) => folder.id);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child.id);
  }
  for (const folder of folders) {
    if (!reachable.has(folder.id)) roots.push(folder);
  }

  const byOrder = (a: T, b: T) => a.order - b.order;
  roots.sort(byOrder);
  for (const siblings of childrenByParent.values()) siblings.sort(byOrder);
  return { roots, childrenByParent };
}
