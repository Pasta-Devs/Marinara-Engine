import { parseChatMetadata } from "./chat-display";

/**
 * The minimum a chat has to expose to be placed in a branch tree. `Chat` satisfies it, and so does a
 * hand-written fixture: the only data the tree reads is the parent pointer inside `metadata`.
 */
export type BranchTreeChat = {
  id: string;
  createdAt?: string | null;
  /** Raw chat metadata: an object, a JSON string, or nothing at all. */
  metadata?: unknown;
};

export type BranchTreeRow<T extends BranchTreeChat> = {
  chat: T;
  /** 0 = the chat itself, 1 = a branch, 2 = a branch of a branch, and so on. */
  depth: number;
};

/**
 * Rows for one branch group, a parent always before its children, the chat itself first at depth 0.
 *
 * Engine-created branches record their immediate source in `metadata.branchParentChatId`, so the
 * hierarchy is already in the list payload and needs no server round trip. Three cases are real data,
 * not hypotheticals: branches made before the field existed (no parent at all), imported siblings
 * (same), and a parent that has since been deleted (points outside the group). Each one flattens into
 * a plain child of the chat rather than being dropped — a chat missing from the list would look like
 * data loss. Lineage that loops back on itself is rendered once and never re-entered, so the walk
 * cannot spin.
 *
 * @param groupChats Chats sharing one `groupId`.
 * @param compareSiblings Order within one level; defaults to oldest first.
 */
export function buildChatBranchRows<T extends BranchTreeChat>(
  groupChats: readonly T[],
  compareSiblings?: (left: T, right: T) => number,
): BranchTreeRow<T>[] {
  const chats = groupChats.filter((chat): chat is T => Boolean(chat?.id));
  if (chats.length <= 1) return chats.map((chat) => ({ chat, depth: 0 }));

  const byId = new Map(chats.map((chat) => [chat.id, chat]));
  const sortSiblings = (siblings: readonly T[]) => [...siblings].sort(compareSiblings ?? byCreationAsc);

  // Only a parent inside this group is lineage. A self-reference is nonsense, and a pointer at a
  // deleted or imported-elsewhere chat says nothing about order, so both fall back to "no parent".
  const parentOf = new Map<string, string>();
  for (const chat of chats) {
    const parentId = readParentChatId(chat);
    if (parentId && parentId !== chat.id && byId.has(parentId)) parentOf.set(chat.id, parentId);
  }

  const childrenOf = new Map<string, T[]>();
  for (const chat of chats) {
    const parentId = parentOf.get(chat.id);
    if (!parentId) continue;
    const children = childrenOf.get(parentId);
    if (children) children.push(chat);
    else childrenOf.set(parentId, [chat]);
  }

  const root = pickRoot(chats, parentOf, byCreationAsc);
  // Parentless chats that are not the chosen root (legacy branch sets, imported siblings) join the
  // root's children, so the walk gives them honest connector flags rather than leaving a trailing
  // line under the group.
  for (const chat of chats) {
    if (chat.id === root.id || parentOf.has(chat.id)) continue;
    const children = childrenOf.get(root.id);
    if (children) children.push(chat);
    else childrenOf.set(root.id, [chat]);
  }
  const rows: BranchTreeRow<T>[] = [];
  const visited = new Set<string>([root.id]);
  // Pre-order depth-first, with a stack rather than recursion: a long chain of branches stays one
  // flat array of work instead of a call per level.
  const stack: BranchTreeRow<T>[] = [{ chat: root, depth: 0 }];
  while (stack.length > 0) {
    const row = stack.pop()!;
    rows.push(row);
    const children = sortSiblings(childrenOf.get(row.chat.id) ?? []).filter((child) => !visited.has(child.id));
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index]!;
      visited.add(child.id);
      stack.push({ chat: child, depth: row.depth + 1 });
    }
  }

  // Anything the walk never reached — the members of a parentless cycle, or extra parentless chats
  // in legacy data — still renders, flattened under the chat, instead of disappearing from the list.
  for (const chat of sortSiblings(chats)) {
    if (visited.has(chat.id)) continue;
    rows.push({ chat, depth: 1 });
  }

  return rows;
}

/**
 * Whether this group has a parent pointer a tree can hang from. Groups without one — branch sets made
 * before lineage was recorded, or Game sessions that are siblings rather than branches — keep the
 * list's single-row behaviour, because drawing a hierarchy the data does not describe would be a lie
 * about someone's chats.
 */
export function hasChatBranchLineage<T extends BranchTreeChat>(groupChats: readonly T[]): boolean {
  const chats = groupChats.filter((chat): chat is T => Boolean(chat?.id));
  if (chats.length < 2) return false;
  const ids = new Set(chats.map((chat) => chat.id));
  return chats.some((chat) => {
    const parentId = readParentChatId(chat);
    return Boolean(parentId) && parentId !== chat.id && ids.has(parentId!);
  });
}

function readParentChatId(chat: BranchTreeChat): string | null {
  const value = parseChatMetadata(chat.metadata).branchParentChatId;
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * The chat the tree hangs from: a lineage root when the data has one, otherwise the oldest chat, so a
 * group whose pointers all reference deleted or each other still gets a stable top instead of none.
 */
function pickRoot<T extends BranchTreeChat>(
  chats: readonly T[],
  parentOf: ReadonlyMap<string, string>,
  compare: (left: T, right: T) => number,
): T {
  const roots = chats.filter((chat) => !parentOf.has(chat.id));
  return [...(roots.length > 0 ? roots : chats)].sort(compare)[0]!;
}

function createdTime(chat: BranchTreeChat): number {
  const time = chat.createdAt ? new Date(chat.createdAt).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : 0;
}

function byCreationAsc(left: BranchTreeChat, right: BranchTreeChat): number {
  const delta = createdTime(left) - createdTime(right);
  return delta !== 0 ? delta : left.id.localeCompare(right.id);
}
