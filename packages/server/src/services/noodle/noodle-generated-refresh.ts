import {
  noodleGeneratedDigestSchema,
  noodleGeneratedFollowSchema,
  noodleGeneratedInteractionSchema,
  noodleGeneratedPostSchema,
  noodleGeneratedRefreshSchema,
  type NoodleGeneratedRefresh,
} from "@marinara-engine/shared";
import { parseGameJsonishSequence } from "../game/jsonish.js";
import { normalizeNoodleHandle } from "./noodle-handle.js";

type RefreshCollection = keyof NoodleGeneratedRefresh;

export type RejectedNoodleGeneratedRefreshItem = {
  collection: RefreshCollection;
  index: number;
  issueCount: number;
};

/**
 * Require a refresh to contain usable activity attributed to the exact cast
 * selected for this run. The persona may be a follow target, but generations
 * must never author posts or interactions on the user's behalf.
 */
export function validateNoodleGeneratedRefresh(
  refresh: NoodleGeneratedRefresh,
  allowedActorHandles: ReadonlySet<string>,
  knownHandles: ReadonlySet<string>,
): string | null {
  const hasActivity =
    refresh.posts.length + refresh.interactions.length + refresh.follows.length + refresh.digests.length > 0;
  if (!hasActivity) return "the response contained no timeline activity";

  const hasUsableAttribution =
    refresh.posts.some((post) => allowedActorHandles.has(normalizeNoodleHandle(post.authorHandle))) ||
    refresh.interactions.some((interaction) => allowedActorHandles.has(normalizeNoodleHandle(interaction.actorHandle))) ||
    refresh.follows.some(
      (follow) =>
        allowedActorHandles.has(normalizeNoodleHandle(follow.actorHandle)) &&
        knownHandles.has(normalizeNoodleHandle(follow.targetHandle)),
    );
  return hasUsableAttribution ? null : "the response used no selected participant handle";
}

const collectionSchemas = {
  posts: noodleGeneratedPostSchema,
  interactions: noodleGeneratedInteractionSchema,
  follows: noodleGeneratedFollowSchema,
  digests: noodleGeneratedDigestSchema,
} as const;

/**
 * Validate generated timeline rows independently. LLM output is untrusted and a
 * single malformed interaction must not discard otherwise valid activity.
 */
export function parseNoodleGeneratedRefresh(value: unknown): {
  refresh: NoodleGeneratedRefresh;
  rejected: RejectedNoodleGeneratedRefreshItem[];
} {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  if (!record) {
    noodleGeneratedRefreshSchema.parse(value);
    return { refresh: { posts: [], interactions: [], follows: [], digests: [] }, rejected: [] };
  }

  const refresh: NoodleGeneratedRefresh = { posts: [], interactions: [], follows: [], digests: [] };
  const rejected: RejectedNoodleGeneratedRefreshItem[] = [];

  for (const collection of Object.keys(collectionSchemas) as RefreshCollection[]) {
    const rows = record[collection];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) {
      rejected.push({ collection, index: -1, issueCount: 1 });
      continue;
    }
    rows.forEach((row, index) => {
      const parsed = collectionSchemas[collection].safeParse(row);
      if (parsed.success) {
        // Each schema is tied to its collection; the indexed assignment keeps
        // that relationship while avoiding four duplicate parsing loops.
        (refresh[collection] as Array<typeof parsed.data>).push(parsed.data);
      } else {
        rejected.push({ collection, index, issueCount: parsed.error.issues.length });
      }
    });
  }

  return { refresh, rejected };
}

/**
 * Recover a complete refresh from adjacent JSON objects. Local models
 * sometimes emit one object per collection (posts, interactions, follows,
 * digests) even though the prompt requests a single enclosing object.
 */
export function parseNoodleGeneratedRefreshResponse(raw: string): {
  refresh: NoodleGeneratedRefresh;
  rejected: RejectedNoodleGeneratedRefreshItem[];
} {
  const parsedValues = parseGameJsonishSequence(raw).flatMap((value) => (Array.isArray(value) ? value : [value]));
  if (parsedValues.length === 1) return parseNoodleGeneratedRefresh(parsedValues[0]);

  const refresh: NoodleGeneratedRefresh = { posts: [], interactions: [], follows: [], digests: [] };
  const rejected: RejectedNoodleGeneratedRefreshItem[] = [];
  const sourceOffsets: Record<RefreshCollection, number> = { posts: 0, interactions: 0, follows: 0, digests: 0 };

  for (const value of parsedValues) {
    const parsed = parseNoodleGeneratedRefresh(value);
    for (const collection of Object.keys(collectionSchemas) as RefreshCollection[]) {
      (refresh[collection] as unknown[]).push(...parsed.refresh[collection]);
      const collectionRejected = parsed.rejected.filter((item) => item.collection === collection);
      rejected.push(
        ...collectionRejected.map((item) => ({
          ...item,
          index: item.index < 0 ? item.index : item.index + sourceOffsets[collection],
        })),
      );
      sourceOffsets[collection] +=
        parsed.refresh[collection].length + collectionRejected.filter((item) => item.index >= 0).length;
    }
  }

  return { refresh, rejected };
}
