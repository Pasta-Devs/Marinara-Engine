import {
  createNoodlePoll,
  type NoodlerGenerationRequest,
  type NoodlerPostCreateInput,
  type NoodlerPostUpdateInput,
  type NoodlerManagedPost,
  type NoodlerRefreshNowOutcome,
} from "@marinara-engine/shared";
import type { NoodleImagePromptReviewItem } from "./noodle-public-images.service.js";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { newId } from "../../utils/id-generator.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { generateNoodlerPost } from "./noodle-noodler-generation.service.js";
import {
  persistNoodlerPostWithUploadedMedia,
  readNoodlerMediaPath,
  unlinkNoodlerMedia,
  type NoodlerPostMediaUpload,
} from "./noodle-noodler-media.js";
import { tryNoodlerAccountOperation } from "./noodle-noodler-account-operation-lock.js";
import { settleAgentJobsWithConcurrencyLimit } from "../agents/agent-concurrency.js";

export type GenerateAndApplyNoodlerPostResult =
  | { status: "generated"; post: NoodlerManagedPost; imagePromptReview: NoodleImagePromptReviewItem | null }
  | { status: "disabled" }
  | { status: "busy" }
  | { status: "connection_required" }
  | { status: "connection_not_found" }
  | { status: "noodler_account_not_found" };

export type CreateNoodlerPostResult =
  | { status: "created"; post: NoodlerManagedPost }
  | { status: "disabled" }
  | { status: "busy" }
  | { status: "noodler_account_not_found" };

export type UpdateNoodlerPostResult =
  | { status: "updated"; post: NoodlerManagedPost }
  | { status: "disabled" }
  | { status: "busy" }
  | { status: "noodler_post_not_found" };

/**
 * Reusable generated-post application seam for HTTP now and Slice 8 scheduling later.
 * Provider and persistence failures intentionally throw for the caller to handle.
 */
export async function generateAndApplyNoodlerPost(
  db: DB,
  request: NoodlerGenerationRequest,
  media?: NoodlerPostMediaUpload,
): Promise<GenerateAndApplyNoodlerPostResult> {
  const noodle = createNoodleStorage(db);
  const settings = await noodle.getSettings();
  if (!settings.enableNoodler) return { status: "disabled" };

  const locked = await tryNoodlerAccountOperation(request.targetAccountId, async () => {
    const account = await noodle.getNoodlerAccountById(request.targetAccountId);
    if (!account) {
      return { status: "noodler_account_not_found" } as const;
    }
    if (request.executionId) {
      const existing = await noodle.getNoodlerPostByWizardExecution(account.id, request.executionId);
      if (existing) {
        return { status: "generated", post: existing, imagePromptReview: null } as const;
      }
    }
    const connectionId = request.connectionId ?? settings.generationConnectionId;
    if (!connectionId) return { status: "connection_required" } as const;
    const connection = await createConnectionsStorage(db).getWithKey(connectionId);
    if (!connection) return { status: "connection_not_found" } as const;
    const generated = await generateNoodlerPost(db, { account, request, connection, media });
    return {
      status: "generated",
      post: generated.post,
      imagePromptReview: generated.imagePromptReview,
    } as const;
  });
  return locked.acquired ? locked.value : { status: "busy" };
}

const MAX_CONCURRENT_MANUAL_REFRESH = 3;

export type NoodlerRefreshNowResult = { status: "disabled" } | { status: "ok"; outcomes: NoodlerRefreshNowOutcome[] };

/**
 * Global "Refresh NoodleR now": explicit user-authorized work, separate from the automatic
 * reserve budget and publication clock.
 */
export async function refreshAllNoodlerCreatorsNow(db: DB): Promise<NoodlerRefreshNowResult> {
  const noodle = createNoodleStorage(db);
  const settings = await noodle.getSettings();
  if (!settings.enableNoodler) return { status: "disabled" };

  const accounts = await noodle.listAutoPostEnabledAccounts();
  const prioritized = [...accounts].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
  const settled = await settleAgentJobsWithConcurrencyLimit(
    prioritized,
    MAX_CONCURRENT_MANUAL_REFRESH,
    async (account): Promise<NoodlerRefreshNowOutcome> => {
      const result = await generateAndApplyNoodlerPost(db, {
        mode: "noodler",
        targetAccountId: account.id,
        access: "locked",
      });
      // "disabled"/"busy" are no-op refreshes, not failures; surface them as skipped so the
      // client doesn't lump a busy creator in with a real generation/connection failure.
      const status = result.status === "disabled" || result.status === "busy" ? "skipped" : result.status;
      return { accountId: account.id, status };
    },
  );

  const outcomes = settled.map((entry, index): NoodlerRefreshNowOutcome => {
    if (entry.status === "fulfilled") return entry.value;
    logger.error(entry.reason, "[noodler] Global refresh failed for creator %s", prioritized[index]!.id);
    return { accountId: prioritized[index]!.id, status: "error" };
  });
  return { status: "ok", outcomes };
}

export async function refreshTargetedNoodlerCreatorsNow(
  db: DB,
  accountIds: string[],
  executionId?: string,
): Promise<NoodlerRefreshNowResult> {
  const noodle = createNoodleStorage(db);
  const settings = await noodle.getSettings();
  if (!settings.enableNoodler) return { status: "disabled" };

  const settled = await settleAgentJobsWithConcurrencyLimit(
    accountIds,
    MAX_CONCURRENT_MANUAL_REFRESH,
    async (accountId): Promise<NoodlerRefreshNowOutcome> => {
      const result = await generateAndApplyNoodlerPost(db, {
        mode: "noodler",
        targetAccountId: accountId,
        access: "locked",
        executionId,
      });
      const status = result.status === "disabled" || result.status === "busy" ? "skipped" : result.status;
      return { accountId, status };
    },
  );
  const outcomes = settled.map((entry, index): NoodlerRefreshNowOutcome => {
    if (entry.status === "fulfilled") return entry.value;
    logger.error(entry.reason, "[noodler] Targeted refresh failed for creator %s", accountIds[index]!);
    return { accountId: accountIds[index]!, status: "error" };
  });
  return { status: "ok", outcomes };
}

export async function createNoodlerPost(
  db: DB,
  input: NoodlerPostCreateInput,
  media?: NoodlerPostMediaUpload,
): Promise<CreateNoodlerPostResult> {
  const noodle = createNoodleStorage(db);
  const settings = await noodle.getSettings();
  if (!settings.enableNoodler) return { status: "disabled" };

  const locked = await tryNoodlerAccountOperation(input.targetAccountId, async () => {
    const postId = media ? newId() : undefined;
    const persist = (persistedMedia?: { imageUrl: string; noodlerMediaPath: string }) =>
      noodle.createNoodlerPost({
        id: postId,
        authorAccountId: input.targetAccountId,
        title: input.title,
        content: input.content,
        source: "manual",
        access: input.access,
        imageUrl: persistedMedia?.imageUrl ?? null,
        metadata: {
          ...(input.poll ? { poll: createNoodlePoll(input.poll) } : {}),
          ...(input.imageCrop ? { imageCrop: input.imageCrop } : {}),
          ...(persistedMedia ? { noodlerMediaPath: persistedMedia.noodlerMediaPath } : {}),
        },
      });
    const post =
      media && postId
        ? await persistNoodlerPostWithUploadedMedia(input.targetAccountId, postId, media, persist)
        : await persist();
    if (!post) return { status: "noodler_account_not_found" } as const;
    await noodle.discardPreparedPostsAfterManualPost(input.targetAccountId, post.createdAt);
    return { status: "created", post } as const;
  });
  return locked.acquired ? locked.value : { status: "busy" };
}

export async function updateNoodlerPostWithMedia(
  db: DB,
  id: string,
  input: NoodlerPostUpdateInput,
  media: NoodlerPostMediaUpload,
): Promise<UpdateNoodlerPostResult> {
  const noodle = createNoodleStorage(db);
  const settings = await noodle.getSettings();
  if (!settings.enableNoodler) return { status: "disabled" };

  const existing = await noodle.getNoodlerPostById(id);
  if (!existing) return { status: "noodler_post_not_found" };

  const locked = await tryNoodlerAccountOperation(existing.authorAccountId, async () => {
    const current = await noodle.getNoodlerPostById(id);
    if (!current) return { status: "noodler_post_not_found" } as const;
    const oldPath = readNoodlerMediaPath(current);
    const post = await persistNoodlerPostWithUploadedMedia(current.authorAccountId, id, media, (persistedMedia) =>
      noodle.updateNoodlerPost(id, input, persistedMedia),
    );
    if (!post) return { status: "noodler_post_not_found" } as const;
    const nextPath = readNoodlerMediaPath(post);
    if (oldPath !== nextPath) unlinkNoodlerMedia(oldPath);
    return { status: "updated", post } as const;
  });
  return locked.acquired ? locked.value : { status: "busy" };
}
