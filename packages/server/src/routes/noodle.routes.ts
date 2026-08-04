// ──────────────────────────────────────────────
// Routes: Noodle Fake Social Media
// ──────────────────────────────────────────────
import { existsSync } from "fs";
import { basename, dirname } from "path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { extname } from "node:path";
import { z } from "zod";
import {
  createNoodlePoll,
  canManageNoodleReply,
  noodleAccountFollowUpdateSchema,
  noodleAmbientProfileRerollSchema,
  noodleAccountProfileUpdateSchema,
  noodleAccountSettingsPatchSchema,
  noodleAccountUpdateSchema,
  noodleBulkInviteSchema,
  noodleBulkNoodlerAccountCreateSchema,
  noodleCreateInteractionSchema,
  noodleCreatePostSchema,
  noodleInviteSchema,
  noodleInteractionOwnerSchema,
  noodleInteractionUpdateSchema,
  noodlePostUpdateSchema,
  noodlerPostCreateSchema,
  noodlerPostCreateWithMediaSchema,
  noodlerGenerationRequestSchema,
  noodlerPostUpdateSchema,
  noodlerAccountCreateSchema,
  noodlerCreatorReplyRequestSchema,
  noodlerCreateInteractionSchema,
  noodlerRemoveInteractionSchema,
  noodlerTargetedRefreshSchema,
  noodlerSubscriptionSchema,
  noodlerUnlockSchema,
  noodlerViewerPersonaSchema,
  noodleRemoveInteractionSchema,
  noodleRescheduleRefreshSchema,
  noodleGenerationRequestSchema,
  noodleSettingsUpdateSchema,
  noodleStageProfileUpdateSchema,
  noodleStageProfileDraftRequestSchema,
  readNoodlePollFromMetadata,
  type NoodleAccount,
  type NoodlerSubscriber,
  type NoodlerPostView,
} from "@marinara-engine/shared";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createNoodleStorage } from "../services/storage/noodle.storage.js";
import { logger } from "../lib/logger.js";
import {
  noodleRefreshSchedulerStatus,
  rescheduleNoodleRefreshTime,
} from "../services/noodle/noodle-refresh-schedule.js";
import { isFileUniqueConstraintError } from "../db/file-schema.js";
import { resolveImageCaptioningRuntime } from "./generate/image-captioning-runtime.js";
import { normalizePromptTimeZone } from "../services/conversation/timezone.js";
import { resolveNoodleAvatarCropAfterProfileUpdate } from "../services/noodle/noodle-profile-avatar.js";
import { isAllowedImageBuffer, safeFetch } from "../utils/security.js";

import { createPublicNoodleGenerationService } from "../services/noodle/noodle-public-generation.service.js";
import { rerollAmbientNoodleProfiles } from "../services/noodle/noodle-ambient-profile-generation.service.js";
import { ensureAmbientNoodleAccounts, isAmbientNoodleAccount } from "../services/noodle/noodle-ambient-profiles.js";
import { createPublicNoodleImagesService } from "../services/noodle/noodle-public-images.service.js";
import {
  buildNoodlerPublicIdentity,
  stageProfileContainsPublicIdentity,
} from "../services/noodle/noodle-noodler-generation.service.js";
import {
  createNoodlerPost,
  generateAndApplyNoodlerPost,
  refreshAllNoodlerCreatorsNow,
  refreshTargetedNoodlerCreatorsNow,
  updateNoodlerPostWithMedia,
} from "../services/noodle/noodle-noodler-post.operation.js";
import { tryNoodlerAccountOperation } from "../services/noodle/noodle-noodler-account-operation-lock.js";
import { generateAndApplyNoodlerCreatorReply } from "../services/noodle/noodle-noodler-creator-reply.operation.js";
import { admissionModeForRequest, isConnectionAdmissionFailure } from "../services/generation/connection-admission.js";
import { generateNoodlerStageProfileDraft } from "../services/noodle/noodle-stage-profile-draft.service.js";
import { canViewNoodlerPost, isNoodlerHiddenFromViewer } from "../services/noodle/noodler-access.js";
import { createNoodlerNoodleImagesService } from "../services/noodle/noodle-noodler-images.service.js";
import { claimNoodleOperation } from "../services/noodle/noodle-operation-lock.js";
import {
  NOODLER_MEDIA_URL_PREFIX,
  noodlerPostMediaUrlForPersona,
  readNoodlerLockedTeaser,
  readNoodlerMediaPath,
  removeNoodlerAccountMedia,
  resolveNoodlerMediaAbsolutePath,
  type NoodlerPostMediaUpload,
  unlinkNoodlerMedia,
} from "../services/noodle/noodle-noodler-media.js";
import {
  bootstrapVisibleNoodle,
  characterAvatarCrop,
  characterNameFromRow,
  ensurePersonaAccounts,
  getErrorMessage,
  interactionDigestVerb,
  mentionedAccountMetadata,
  mentionedCharacterAccounts,
  noodleDigestAccountLabel,
  parseRecord,
  resolvePersonaAccount,
} from "../services/noodle/noodle-public-support.js";

const noodleImagePromptConfirmationSchema = z.object({
  prompts: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().trim().min(1).max(20_000),
        negativePrompt: z.string().trim().max(20_000).optional(),
      }),
    )
    .max(20),
  debugMode: z.boolean().optional(),
});

/** The `identity` lock is shared by refresh, reroll, and profile edits, so the 409 stays operation-neutral. */
const NOODLE_IDENTITY_LOCK_BUSY = "Another Noodle identity operation is already running. Wait for it to finish.";
const NOODLER_MEDIA_MAX_BYTES = 20 * 1024 * 1024;
const NOODLER_MEDIA_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

class NoodlerMediaRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

async function readNoodlerMultipart(req: FastifyRequest): Promise<{ payload: unknown; media: NoodlerPostMediaUpload }> {
  let payload: unknown;
  let media: NoodlerPostMediaUpload | null = null;
  for await (const part of req.parts({ limits: { fileSize: NOODLER_MEDIA_MAX_BYTES, files: 1 } })) {
    if (part.type === "field") {
      if (part.fieldname === "payload") {
        try {
          payload = JSON.parse(String(part.value));
        } catch {
          throw new NoodlerMediaRequestError("The image request payload is invalid.", 400);
        }
      }
      continue;
    }
    if (part.fieldname !== "file" || media) {
      part.file.resume();
      throw new NoodlerMediaRequestError("Upload one image in the file field.", 400);
    }
    const extension = extname(part.filename).toLowerCase();
    if (!NOODLER_MEDIA_EXTENSIONS.has(extension)) {
      part.file.resume();
      throw new NoodlerMediaRequestError("Unsupported image file type.", 400);
    }
    let buffer: Buffer;
    try {
      buffer = await part.toBuffer();
    } catch (error) {
      const truncated = (part.file as typeof part.file & { truncated?: boolean }).truncated === true;
      const tooLarge = truncated || (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE";
      throw new NoodlerMediaRequestError(
        tooLarge ? "NoodleR image is too large." : "Failed to read the uploaded image.",
        tooLarge ? 413 : 400,
      );
    }
    const detected = isAllowedImageBuffer(buffer, extension);
    if (!detected || (extension === ".jpeg" ? "jpg" : extension.slice(1)) !== detected.ext) {
      throw new NoodlerMediaRequestError("Unsupported or invalid image file.", 400);
    }
    media = { buffer, extension: detected.ext };
  }
  if (payload === undefined) {
    throw new NoodlerMediaRequestError("The image request payload is required.", 400);
  }
  if (!media) throw new NoodlerMediaRequestError("Upload one image in the file field.", 400);
  return { payload, media };
}

async function importNoodlerMedia(imageUrl: string): Promise<NoodlerPostMediaUpload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await safeFetch(imageUrl, {
      signal: controller.signal,
      policy: {
        allowLocal: false,
        allowLoopback: false,
        allowedProtocols: ["http:", "https:"],
        maxRedirects: 3,
      },
      maxResponseBytes: NOODLER_MEDIA_MAX_BYTES,
      allowedContentTypes: ["image/"],
      allowMissingContentType: true,
      headers: { Accept: "image/*" },
    });
    if (!response.ok) {
      throw new NoodlerMediaRequestError(`Image URL returned HTTP ${response.status}.`, 400);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const detected = isAllowedImageBuffer(buffer);
    if (!detected) {
      throw new NoodlerMediaRequestError("The URL did not return a supported image.", 415);
    }
    return { buffer, extension: detected.ext };
  } catch (error) {
    if (error instanceof NoodlerMediaRequestError) throw error;
    logger.warn(error, "[noodler] Could not import image URL");
    const tooLarge = error instanceof Error && /exceeded \d+ bytes/iu.test(error.message);
    throw new NoodlerMediaRequestError(
      tooLarge
        ? "NoodleR image is too large."
        : "Could not download that image URL. Check that it is public and points directly to an image.",
      tooLarge ? 413 : 400,
    );
  } finally {
    clearTimeout(timeout);
  }
}

type DecodedNoodlerMediaRequest<T> =
  | { success: true; data: T; media: NoodlerPostMediaUpload | undefined }
  | { success: false; error: z.ZodError };

async function decodeNoodlerMediaRequest<WithMediaSchema extends z.ZodTypeAny, WithoutMediaSchema extends z.ZodTypeAny>(
  req: FastifyRequest,
  schemas: { withMedia: WithMediaSchema; withoutMedia: WithoutMediaSchema },
): Promise<DecodedNoodlerMediaRequest<z.output<WithMediaSchema> | z.output<WithoutMediaSchema>>> {
  let payload: unknown = req.body;
  let media: NoodlerPostMediaUpload | undefined;
  if (req.headers["content-type"]?.startsWith("multipart/form-data")) {
    const multipart = await readNoodlerMultipart(req);
    payload = multipart.payload;
    media = multipart.media;
  }

  const parsedForUrl = schemas.withMedia.safeParse(payload);
  const uploadedImageUrl =
    parsedForUrl.success && typeof (parsedForUrl.data as { uploadedImageUrl?: unknown }).uploadedImageUrl === "string"
      ? (parsedForUrl.data as { uploadedImageUrl: string }).uploadedImageUrl
      : undefined;
  if (uploadedImageUrl) {
    if (media) {
      throw new NoodlerMediaRequestError("Choose either an uploaded file or an image URL.", 400);
    }
    media = await importNoodlerMedia(uploadedImageUrl);
  }

  const parsed = (media ? schemas.withMedia : schemas.withoutMedia).safeParse(payload);
  return parsed.success ? { success: true, data: parsed.data, media } : { success: false, error: parsed.error };
}

function sendNoodlerMediaError(reply: FastifyReply, error: unknown) {
  const tooLarge = (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE";
  const statusCode = tooLarge ? 413 : error instanceof NoodlerMediaRequestError ? error.statusCode : 500;
  if (statusCode === 500) logger.error(error, "[noodler] Image request failed");
  return reply.code(statusCode).send({
    error:
      statusCode === 500
        ? "Image request failed."
        : tooLarge
          ? "NoodleR image is too large."
          : (error as Error).message,
  });
}

export async function noodleRoutes(app: FastifyInstance) {
  const noodle = createNoodleStorage(app.db);
  const characters = createCharactersStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const publicGeneration = createPublicNoodleGenerationService(app.db);
  const publicImages = createPublicNoodleImagesService(app.db);
  const noodlerImages = createNoodlerNoodleImagesService(app.db);

  async function resolveNoodlerPublicIdentity(publicAccount: NoodleAccount) {
    const sourceCharacter =
      publicAccount.kind === "character" ? await characters.getById(publicAccount.entityId) : null;
    return buildNoodlerPublicIdentity(publicAccount, sourceCharacter);
  }

  app.get("/", async () => {
    return bootstrapVisibleNoodle(noodle, characters);
  });

  app.put("/settings", async (req, reply) => {
    const parsed = noodleSettingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return noodle.updateSettings(parsed.data);
  });

  app.post("/ambient-profiles/reroll", async (req, reply) => {
    const parsed = noodleAmbientProfileRerollSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const releaseOperation = claimNoodleOperation("identity");
    if (!releaseOperation) return reply.code(409).send({ error: NOODLE_IDENTITY_LOCK_BUSY });
    try {
      const settings = await noodle.getSettings();
      const connectionId = settings.generationConnectionId;
      if (!connectionId) return reply.code(400).send({ error: "Select a Noodle generation connection first." });
      const connection = await connections.getWithKey(connectionId);
      if (!connection) return reply.code(404).send({ error: "Noodle generation connection not found" });
      await ensureAmbientNoodleAccounts(noodle, settings.allowRandomUsers);
      const accounts = (
        await Promise.all(parsed.data.accountIds.map((accountId) => noodle.getAccountById(accountId)))
      ).filter((account): account is NoodleAccount => account !== null);
      if (
        accounts.length !== parsed.data.accountIds.length ||
        accounts.some((account) => !isAmbientNoodleAccount(account))
      ) {
        return reply.code(400).send({ error: "Only managed Ambient Noodle profiles can be rerolled." });
      }
      return await rerollAmbientNoodleProfiles({
        db: app.db,
        noodle,
        accounts,
        connection,
        debugMode: parsed.data.debugMode,
      });
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      logger.error(error, "[noodle] Ambient profile reroll failed");
      return reply.code(500).send({ error: getErrorMessage(error) });
    } finally {
      releaseOperation();
    }
  });

  app.get("/noodler/accounts", async (_req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    return noodle.listNoodlerStageProfiles();
  });

  async function resolveViewerPersona(personaId: string) {
    const account = await noodle.getAccountByEntity("persona", personaId);
    return account?.platform === "noodle" ? account : null;
  }

  // Shared viewer-scope builder: also returned from the unlock/subscribe mutations so the
  // client can patch its cache in place instead of refetching the whole feed (avoids the
  // reload-and-jump when a post is revealed).
  async function buildViewerScope(viewer: NonNullable<Awaited<ReturnType<typeof resolveViewerPersona>>>) {
    const [accounts, profiles, subscriptions, unlocks] = await Promise.all([
      noodle.listNoodlerAccounts(),
      noodle.listNoodlerStageProfiles(),
      noodle.listSubscriptionsForViewer(viewer.id),
      noodle.listPostUnlocksForViewer(viewer.id),
    ]);
    const subscribedIds = new Set(subscriptions.map((item) => item.creatorAccountId));
    const followedIds = new Set(viewer.settings.social.followingAccountIds ?? []);
    const unlockedIds = new Set(unlocks.map((item) => item.postId));
    const profileById = new Map(
      profiles.map(({ access: _access, ...profile }) => [
        profile.id,
        {
          ...profile,
          noodleAccountId: profile.disclosureMode === "open" ? profile.noodleAccountId : null,
        },
      ]),
    );
    const visibleAccounts = accounts.filter(
      (account) => account.noodleAccountId === viewer.id || !isNoodlerHiddenFromViewer(account, viewer.id),
    );
    const postsByAccount = await noodle.listNoodlerPostsByAccounts(
      visibleAccounts.map((account) => account.id),
      40,
    );
    const viewablePostIds = new Set<string>();
    for (const account of visibleAccounts) {
      const ownCreator = account.noodleAccountId === viewer.id;
      const subscribed = subscribedIds.has(account.id);
      for (const post of postsByAccount.get(account.id) ?? []) {
        if (
          ownCreator ||
          canViewNoodlerPost({
            post,
            subscribed,
            unlockedPostIds: unlockedIds,
          })
        ) {
          viewablePostIds.add(post.id);
        }
      }
    }
    // Counts are loaded for every post so locked teasers can show real engagement;
    // the interaction records themselves stay redacted unless the post is viewable.
    const allPostIds = [...postsByAccount.values()].flatMap((posts) => posts.map((post) => post.id));
    const interactionsByPostId = new Map<string, NoodlerPostView["interactions"]>();
    for (const interaction of await noodle.listNoodlerInteractions(allPostIds)) {
      const existing = interactionsByPostId.get(interaction.postId) ?? [];
      existing.push(interaction);
      interactionsByPostId.set(interaction.postId, existing);
    }
    const creators = visibleAccounts.map((account) => {
      const subscribed = subscribedIds.has(account.id);
      const posts = postsByAccount.get(account.id) ?? [];
      return {
        profile: profileById.get(account.id)!,
        subscribed,
        followed: followedIds.has(account.id),
        posts: posts.map((post): NoodlerPostView => {
          const locked = !viewablePostIds.has(post.id);
          const interactions = interactionsByPostId.get(post.id) ?? [];
          return {
            id: post.id,
            authorAccountId: post.authorAccountId,
            access: post.access,
            locked,
            // Titles and engagement counts are public teaser data.
            title: post.title,
            content: locked ? null : post.content,
            // Locked posts keep their media URL: the access-checked media route answers a
            // locked viewer with a server-blurred teaser, never the original bytes. Media
            // stored outside the NoodleR namespace has no such derivative, so it is withheld.
            hasImage: post.imageUrl !== null,
            imageUrl:
              locked && !post.imageUrl?.startsWith(NOODLER_MEDIA_URL_PREFIX)
                ? null
                : noodlerPostMediaUrlForPersona(post.imageUrl, viewer.entityId),
            imagePrompt: locked ? null : post.imagePrompt,
            metadata: locked ? null : post.metadata,
            createdAt: post.createdAt,
            interactions: locked ? [] : interactions,
            likeCount: interactions.filter((item) => item.type === "like").length,
            replyCount: interactions.filter((item) => item.type === "reply").length,
          };
        }),
      };
    });
    return { viewer, creators };
  }

  app.get("/noodler/viewer", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Noodle persona not found" });
    return await buildViewerScope(viewer);
  });

  async function resolveReadableNoodlerPost(personaId: string, postId: string) {
    const viewer = await resolveViewerPersona(personaId);
    const post = viewer ? await noodle.getNoodlerPostById(postId) : null;
    const creator = post ? await noodle.getNoodlerAccountById(post.authorAccountId) : null;
    if (!viewer || !post || !creator || isNoodlerHiddenFromViewer(creator, viewer.id)) return null;
    if (creator.noodleAccountId === viewer.id) return { viewer, post, creator, locked: false };
    const [subscriptions, unlocks] = await Promise.all([
      noodle.listSubscriptionsForViewer(viewer.id),
      noodle.listPostUnlocksForViewer(viewer.id),
    ]);
    const subscribed = subscriptions.some((item) => item.creatorAccountId === creator.id);
    const locked = !canViewNoodlerPost({
      post,
      subscribed,
      unlockedPostIds: new Set(unlocks.map((item) => item.postId)),
    });
    // Locked is reported rather than refused: the media route still owes a locked viewer a
    // blurred teaser. Every caller that needs the post's protected content checks it.
    return { viewer, post, creator, locked };
  }

  async function resolveGatedNoodlerPost(personaId: string, postId: string) {
    const readable = await resolveReadableNoodlerPost(personaId, postId);
    // A viewer persona linked to the creator's own public account may read its posts, but
    // is not an audience member and must not persist self-interactions.
    if (!readable || readable.locked || readable.creator.noodleAccountId === readable.viewer.id) return null;
    return readable;
  }

  // Access-checked serving for NoodleR-owned media. A persona query gates as a fan
  // (subscriber/unlock/hidden all enforced), which is why audience-facing projections bind
  // the viewer's persona into every media URL they hand out. No persona is the owner path,
  // the same trusted management surface as the other /noodler/accounts routes. The bytes
  // live outside any publicly readable gallery namespace, so this is the only way in.
  app.get("/noodler/posts/:id/media", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const { id } = req.params as { id: string };
    const personaId = (req.query as { personaId?: string }).personaId;
    const readable = personaId ? await resolveReadableNoodlerPost(personaId, id) : null;
    const post = personaId ? readable?.post : await noodle.getNoodlerPostById(id);
    if (!post) return reply.code(404).send({ error: "Not Found" });
    const mediaPath = readNoodlerMediaPath(post);
    const absolute = mediaPath ? resolveNoodlerMediaAbsolutePath(mediaPath) : null;
    if (!absolute || !existsSync(absolute)) return reply.code(404).send({ error: "Not Found" });
    // A locked viewer gets the blurred derivative, never the original bytes. If it cannot be
    // built the frame stays empty rather than falling back to the protected image.
    if (readable?.locked) {
      const teaser = await readNoodlerLockedTeaser(absolute);
      if (!teaser) return reply.code(404).send({ error: "Not Found" });
      return reply.header("Cache-Control", "private, no-store").type("image/jpeg").send(teaser);
    }
    return reply.header("Cache-Control", "private, no-store").sendFile(basename(absolute), dirname(absolute));
  });

  app.post("/noodler/posts/:id/interactions", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerCreateInteractionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const gated = await resolveGatedNoodlerPost(parsed.data.personaId, id);
    if (!gated) return reply.code(404).send({ error: "NoodleR post not found" });
    if (parsed.data.type === "vote") {
      const poll = readNoodlePollFromMetadata(gated.post.metadata);
      const optionId = parsed.data.content?.trim() ?? "";
      if (!poll?.options.some((option) => option.id === optionId)) {
        return reply.code(400).send({ error: "Choose a valid poll option." });
      }
    }
    const interaction = await noodle.createNoodlerInteraction(id, {
      actorAccountId: gated.viewer.id,
      type: parsed.data.type,
      content: parsed.data.content ?? null,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(400).send({ error: "Could not add that NoodleR interaction." });
    return reply.code(201).send(interaction);
  });

  app.post("/noodler/posts/:postId/interactions/:interactionId/creator-reply", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerCreatorReplyRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Noodle persona not found" });
    try {
      const result = await generateAndApplyNoodlerCreatorReply(app.db, {
        postId,
        parentInteractionId: interactionId,
        viewerAccountId: viewer.id,
        debugMode: parsed.data.debugMode === true,
      });
      if (result.status === "generated") return reply.code(201).send(result);
      if (result.status === "busy") {
        return reply.code(409).send({ error: "Another operation for this NoodleR account is already running." });
      }
      if (result.status === "connection_required") {
        return reply.code(400).send({ error: "Select a Noodle generation connection first." });
      }
      if (result.status === "connection_not_found") {
        return reply.code(404).send({ error: "Noodle generation connection not found" });
      }
      if (result.status === "exhausted") {
        // The ceiling is installation-wide, not per creator: saying otherwise sends the user to
        // another creator that is just as blocked.
        return reply.code(429).send({ error: "No automatic creator replies are left in the last 24 hours." });
      }
      if (result.status === "ineligible") {
        return reply.code(404).send({ error: "That NoodleR reply can no longer receive a creator reply." });
      }
      // `duplicate` carries the existing interaction and is a success: the reply the caller
      // wanted is already there.
      return result;
    } catch (error) {
      logger.error(error, "[noodler-reply] Creator reply generation failed");
      return reply.code(500).send({ error: getErrorMessage(error) });
    }
  });

  app.delete("/noodler/posts/:id/interactions", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerRemoveInteractionSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const gated = await resolveGatedNoodlerPost(parsed.data.personaId, id);
    if (!gated) return reply.code(404).send({ error: "NoodleR post not found" });
    const interaction = await noodle.deleteNoodlerInteraction(id, {
      actorAccountId: gated.viewer.id,
      type: parsed.data.type,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(404).send({ error: "NoodleR interaction not found" });
    return interaction;
  });

  // NoodleR posts are stage-profile posts the user fully owns, so edit/delete route
  // through the NoodleR-only storage methods (getNoodlerPostById) rather than the Noodle
  // /posts endpoints, which reject any post whose author is not a Noodle account.
  app.patch("/noodler/posts/:id", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerPostUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const existing = await noodle.getNoodlerPostById(id);
    if (!existing) return reply.code(404).send({ error: "NoodleR post not found" });
    const nextContent = parsed.data.content === undefined ? existing.content : parsed.data.content;
    const nextPoll =
      parsed.data.poll === undefined
        ? readNoodlePollFromMetadata(existing.metadata)
        : parsed.data.poll
          ? createNoodlePoll(parsed.data.poll)
          : null;
    const nextHasImage = parsed.data.removeImage ? false : Boolean(existing.imageUrl);
    if (!nextContent.trim() && !nextPoll && !nextHasImage) {
      return reply.code(400).send({ error: "Posts need a body, image, or poll." });
    }
    // The media path has to be re-read under the lock: the pre-lock `existing` snapshot can
    // name a file a concurrent write already replaced, and unlinking that deletes live bytes.
    const locked = await tryNoodlerAccountOperation(existing.authorAccountId, async () => {
      const current = parsed.data.removeImage ? await noodle.getNoodlerPostById(id) : null;
      const updated = await noodle.updateNoodlerPost(id, parsed.data);
      return updated ? { updated, staleMedia: current ? readNoodlerMediaPath(current) : null } : null;
    });
    if (!locked.acquired) {
      return reply.code(409).send({ error: "Another operation for this NoodleR account is already running." });
    }
    if (!locked.value) return reply.code(404).send({ error: "NoodleR post not found" });
    if (parsed.data.removeImage) unlinkNoodlerMedia(locked.value.staleMedia);
    return locked.value.updated;
  });

  app.post("/noodler/posts", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    let decoded: DecodedNoodlerMediaRequest<
      z.output<typeof noodlerPostCreateWithMediaSchema> | z.output<typeof noodlerPostCreateSchema>
    >;
    try {
      decoded = await decodeNoodlerMediaRequest(req, {
        withMedia: noodlerPostCreateWithMediaSchema,
        withoutMedia: noodlerPostCreateSchema,
      });
    } catch (error) {
      return sendNoodlerMediaError(reply, error);
    }
    if (!decoded.success) return reply.code(400).send({ error: decoded.error.flatten() });
    const result = await createNoodlerPost(app.db, decoded.data, decoded.media);
    if (result.status === "created") return reply.code(201).send(result.post);
    if (result.status === "busy") {
      return reply.code(409).send({ error: "Another operation for this NoodleR account is already running." });
    }
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    return reply.code(404).send({ error: "NoodleR stage profile not found" });
  });

  app.post("/noodler/posts/:id/media", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const { id } = req.params as { id: string };
    let multipart: Awaited<ReturnType<typeof readNoodlerMultipart>>;
    try {
      multipart = await readNoodlerMultipart(req);
    } catch (error) {
      return sendNoodlerMediaError(reply, error);
    }
    const parsed = noodlerPostUpdateSchema.safeParse(multipart.payload);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.removeImage) {
      return reply.code(400).send({ error: "A replacement image cannot also remove the image." });
    }
    const result = await updateNoodlerPostWithMedia(app.db, id, parsed.data, multipart.media);
    if (result.status === "updated") return result.post;
    if (result.status === "busy") {
      return reply.code(409).send({ error: "Another operation for this NoodleR account is already running." });
    }
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    return reply.code(404).send({ error: "NoodleR post not found" });
  });

  app.delete("/noodler/posts/:id", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const { id } = req.params as { id: string };
    const existing = await noodle.getNoodlerPostById(id);
    if (!existing) return reply.code(404).send({ error: "NoodleR post not found" });
    const locked = await tryNoodlerAccountOperation(existing.authorAccountId, () => noodle.deleteNoodlerPost(id));
    if (!locked.acquired) {
      return reply.code(409).send({ error: "Another operation for this NoodleR account is already running." });
    }
    if (!locked.value) return reply.code(404).send({ error: "NoodleR post not found" });
    unlinkNoodlerMedia(readNoodlerMediaPath(locked.value));
    return locked.value;
  });

  app.post("/noodler/accounts/:id/subscribe", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const [viewer, creator] = await Promise.all([
      resolveViewerPersona(parsed.data.personaId),
      noodle.getNoodlerAccountById(id),
    ]);
    if (!viewer || !creator || creator.noodleAccountId === viewer.id || isNoodlerHiddenFromViewer(creator, viewer.id)) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    const subscription = await noodle.subscribe(viewer.id, creator.id);
    if (!subscription) return reply.code(400).send({ error: "Could not subscribe to this stage profile" });
    const freshViewer = await resolveViewerPersona(parsed.data.personaId);
    return reply.code(201).send(await buildViewerScope(freshViewer ?? viewer));
  });

  app.delete("/noodler/accounts/:id/subscribe", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerSubscriptionSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Noodle persona not found" });
    const { id } = req.params as { id: string };
    await noodle.unsubscribe(viewer.id, id);
    const freshViewer = await resolveViewerPersona(parsed.data.personaId);
    return await buildViewerScope(freshViewer ?? viewer);
  });

  app.get("/noodler/accounts/:id/subscribers", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const { id } = req.params as { id: string };
    if (!(await noodle.getNoodlerAccountById(id))) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    const subscriptions = await noodle.listSubscriptionsForCreator(id);
    const subscribers = (
      await Promise.all(
        subscriptions.map(async (subscription): Promise<NoodlerSubscriber | null> => {
          const account = await noodle.getAccountById(subscription.viewerAccountId);
          if (!account || account.platform !== "noodle" || account.kind !== "persona") return null;
          return {
            id: account.id,
            displayName: account.displayName,
            handle: account.handle,
            avatarUrl: account.avatarUrl,
            avatarCrop: account.avatarCrop,
            subscribedAt: subscription.createdAt,
          };
        }),
      )
    ).filter((subscriber): subscriber is NoodlerSubscriber => subscriber !== null);
    return subscribers;
  });

  app.patch("/noodler/accounts/:id/follow", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const body = req.body as { personaId?: unknown; followed?: unknown };
    if (typeof body?.personaId !== "string" || typeof body.followed !== "boolean") {
      return reply.code(400).send({ error: "personaId and followed are required" });
    }
    const { id } = req.params as { id: string };
    const viewer = await resolveViewerPersona(body.personaId);
    const creator = await noodle.getNoodlerAccountById(id);
    if (!viewer || !creator || creator.noodleAccountId === viewer.id || isNoodlerHiddenFromViewer(creator, viewer.id)) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    const updated = await noodle.updateAccountFollow(viewer.id, creator.id, body.followed);
    if (!updated) return reply.code(400).send({ error: "Could not update follow state" });
    const freshViewer = await resolveViewerPersona(body.personaId);
    return buildViewerScope(freshViewer ?? updated.account);
  });

  app.post("/noodler/posts/:id/unlock", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerUnlockSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const [viewer, post] = await Promise.all([
      resolveViewerPersona(parsed.data.personaId),
      noodle.getNoodlerPostById(id),
    ]);
    const creator = post ? await noodle.getNoodlerAccountById(post.authorAccountId) : null;
    if (
      !viewer ||
      !post ||
      !creator ||
      post.access !== "locked" ||
      creator.noodleAccountId === viewer.id ||
      isNoodlerHiddenFromViewer(creator, viewer.id)
    ) {
      return reply.code(404).send({ error: "NoodleR post not found" });
    }
    const unlock = await noodle.unlockPost(viewer.id, post.id);
    if (!unlock) return reply.code(400).send({ error: "Could not unlock this post" });
    return reply.code(201).send(await buildViewerScope(viewer));
  });

  app.get<{ Querystring: { limit?: string; offset?: string; search?: string; kind?: string } }>(
    "/noodler/eligible-accounts",
    async (req, reply) => {
      const settings = await noodle.getSettings();
      if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
      const [publicAccounts, noodlerAccounts] = await Promise.all([
        noodle.listAccounts(),
        noodle.listNoodlerAccounts(),
      ]);
      const linkedIds = new Set(noodlerAccounts.flatMap((account) => account.noodleAccountId ?? []));
      const search = (req.query.search ?? "").trim().toLocaleLowerCase();
      const kind = req.query.kind === "character" || req.query.kind === "persona" ? req.query.kind : null;
      const eligibleAccounts = publicAccounts.filter(
        (account) =>
          (account.kind === "persona" || account.kind === "character") &&
          (!kind || account.kind === kind) &&
          !linkedIds.has(account.id),
      );
      const filteredAccounts = search
        ? eligibleAccounts.filter((account) =>
            `${account.displayName} ${account.handle} ${account.bio}`.toLocaleLowerCase().includes(search),
          )
        : eligibleAccounts;
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      return {
        items: filteredAccounts.slice(offset, offset + limit),
        limit,
        offset,
        hasMore: offset + limit < filteredAccounts.length,
      };
    },
  );

  app.post("/noodler/stage-profile-draft", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodleStageProfileDraftRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const connectionId = parsed.data.connectionId || settings.generationConnectionId;
    if (!connectionId) return reply.code(400).send({ error: "Select a Noodle generation connection first." });
    const connection = await connections.getWithKey(connectionId);
    if (!connection) return reply.code(404).send({ error: "Noodle generation connection not found" });
    try {
      return await generateNoodlerStageProfileDraft(app.db, { request: parsed.data, connection });
    } catch (error) {
      logger.error(error, "[noodler] Stage profile draft generation failed");
      return reply.code(500).send({ error: getErrorMessage(error) });
    }
  });

  app.post("/accounts/:id/noodler", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerAccountCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const publicAccount = await noodle.getAccountById(id);
    if (
      publicAccount &&
      stageProfileContainsPublicIdentity(parsed.data.stageProfile, await resolveNoodlerPublicIdentity(publicAccount))
    ) {
      return reply.code(400).send({
        error: "Hinted and secret stage profiles cannot use the linked public name or handle.",
      });
    }
    try {
      const created = await noodle.createNoodlerAccount(id, parsed.data.stageProfile);
      if (!created) return reply.code(404).send({ error: "Noodle account not found" });
      const profile = (await noodle.listNoodlerStageProfiles()).find((item) => item.id === created.id);
      if (!profile) throw new Error("Failed to load the created NoodleR stage profile.");
      return reply.code(201).send(profile);
    } catch (error) {
      if (isFileUniqueConstraintError(error, "noodle_accounts", ["noodleAccountId"])) {
        return reply.code(409).send({ error: "A NoodleR account already exists for this Noodle account." });
      }
      throw error;
    }
  });

  app.post("/noodler/accounts/bulk", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodleBulkNoodlerAccountCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { noodleAccountIds, disclosureMode, disclosureExceptions, autoPosting, executionId } = parsed.data;
    if (noodleAccountIds.length === 0) {
      return reply.code(201).send({ created: [], skipped: [], failed: [], executionId });
    }
    const connectionId = settings.generationConnectionId;
    if (!connectionId) return reply.code(400).send({ error: "Select a Noodle generation connection first." });
    const connection = await connections.getWithKey(connectionId);
    if (!connection) return reply.code(404).send({ error: "Noodle generation connection not found" });
    const created: string[] = [];
    const skipped: string[] = [];
    // Operational failures (provider/storage) are reported apart from expected exclusions
    // so a provider outage cannot look like a batch of harmless skips.
    const failed: string[] = [];
    // The account row and its scheduler settings are two writes. A retry that finds the row
    // already there must still apply the settings, or a creator whose first attempt failed
    // between the two is reported as created while never receiving its auto-posting config.
    const applyAutoPosting = (accountId: string) =>
      noodle.patchAccountSettings(accountId, { subtree: "scheduler", patch: { autoPosting } });
    for (const noodleAccountId of noodleAccountIds) {
      const existing = await noodle.getNoodlerAccountForNoodleAccount(noodleAccountId);
      if (existing) {
        if (executionId && existing.settings.profile.noodlerWizardExecutionId === executionId) {
          try {
            await applyAutoPosting(existing.id);
            created.push(existing.id);
          } catch (error) {
            logger.error(error, "[noodler] Bulk replay could not apply auto-posting for %s", noodleAccountId);
            failed.push(noodleAccountId);
          }
        } else {
          skipped.push(noodleAccountId);
        }
        continue;
      }
      const accountDisclosure = disclosureExceptions[noodleAccountId] ?? disclosureMode;
      const publicAccount = await noodle.getAccountById(noodleAccountId);
      if (!publicAccount) {
        skipped.push(noodleAccountId);
        continue;
      }
      try {
        // ponytail: sequential per-account LLM generation (up to 100). Correct but slow;
        // add a small concurrency limit only if bulk latency becomes a real complaint.
        const stageProfile = await generateNoodlerStageProfileDraft(app.db, {
          request: { noodleAccountId, disclosureMode: accountDisclosure, guidance: "" },
          connection,
        });
        // Belt-and-braces: the generator already enforces leak protection, but keep the guard.
        if (stageProfileContainsPublicIdentity(stageProfile, await resolveNoodlerPublicIdentity(publicAccount))) {
          skipped.push(noodleAccountId);
          continue;
        }
        const account = await noodle.createNoodlerAccount(noodleAccountId, stageProfile, executionId);
        if (!account) {
          skipped.push(noodleAccountId);
          continue;
        }
        await applyAutoPosting(account.id);
        created.push(account.id);
      } catch (error) {
        if (isFileUniqueConstraintError(error, "noodle_accounts", ["noodleAccountId"])) {
          const replayed = await noodle.getNoodlerAccountForNoodleAccount(noodleAccountId);
          if (executionId && replayed?.settings.profile.noodlerWizardExecutionId === executionId) {
            // This branch already runs inside the outer catch, so an unguarded throw here would
            // escape the loop and fail the whole batch instead of this one creator.
            try {
              await applyAutoPosting(replayed.id);
              created.push(replayed.id);
            } catch (autoPostingError) {
              logger.error(
                autoPostingError,
                "[noodler] Bulk replay could not apply auto-posting for %s",
                noodleAccountId,
              );
              failed.push(noodleAccountId);
            }
          } else {
            skipped.push(noodleAccountId);
          }
          continue;
        }
        logger.error(error, "[noodler] Bulk stage profile generation failed for %s", noodleAccountId);
        failed.push(noodleAccountId);
        continue;
      }
    }
    const profiles = await noodle.listNoodlerStageProfiles();
    return reply.code(201).send({
      created: profiles.filter((profile) => created.includes(profile.id)),
      skipped,
      failed,
      executionId,
    });
  });

  app.put("/noodler/accounts/:id/stage-profile", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodleStageProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const locked = await tryNoodlerAccountOperation(id, async () => {
      const noodlerAccount = await noodle.getNoodlerAccountById(id);
      const publicAccount = noodlerAccount?.noodleAccountId
        ? await noodle.getAccountById(noodlerAccount.noodleAccountId)
        : null;
      if (
        publicAccount &&
        stageProfileContainsPublicIdentity(parsed.data, await resolveNoodlerPublicIdentity(publicAccount))
      ) {
        return { status: "identity_conflict" } as const;
      }
      const updated = await noodle.updateNoodlerStageProfile(id, parsed.data);
      if (!updated) return { status: "not_found" } as const;
      const profile = (await noodle.listNoodlerStageProfiles()).find((item) => item.id === updated.id);
      if (!profile) throw new Error("Failed to load the updated NoodleR stage profile.");
      return { status: "updated", profile } as const;
    });
    if (!locked.acquired) {
      return reply.code(409).send({ error: "Another operation for this NoodleR account is already running." });
    }
    if (locked.value.status === "identity_conflict") {
      return reply.code(400).send({
        error: "Hinted and secret stage profiles cannot use the linked public name or handle.",
      });
    }
    if (locked.value.status === "not_found") {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    return locked.value.profile;
  });

  app.delete("/noodler/accounts/:id", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const { id } = req.params as { id: string };
    const locked = await tryNoodlerAccountOperation(id, () => noodle.deleteNoodlerAccount(id));
    if (!locked.acquired) {
      return reply.code(409).send({ error: "Another operation for this NoodleR account is already running." });
    }
    const deleted = locked.value;
    if (!deleted) return reply.code(404).send({ error: "NoodleR stage profile not found" });
    removeNoodlerAccountMedia(id);
    return deleted;
  });

  app.get("/noodler/accounts/:id/posts", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const { id } = req.params as { id: string };
    if (!(await noodle.getNoodlerAccountById(id))) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    return noodle.listNoodlerPostsByAccount(id, 40);
  });

  app.put("/refresh-schedule", async (req, reply) => {
    const parsed = noodleRescheduleRefreshSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    // Hold the lock across the read-modify-write: a bare check leaves a window for a refresh
    // to claim in between and have its schedule overwritten.
    const releaseOperation = claimNoodleOperation("identity");
    if (!releaseOperation) return reply.code(409).send({ error: NOODLE_IDENTITY_LOCK_BUSY });
    const at = new Date();
    try {
      const schedule = await noodle.ensureRefreshSchedule(at);
      const rescheduled = rescheduleNoodleRefreshTime(schedule, parsed.data.scheduledTime, parsed.data.time, at);
      await noodle.saveRefreshSchedule(rescheduled);
      return noodleRefreshSchedulerStatus(rescheduled, at);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Could not reschedule refresh." });
    } finally {
      releaseOperation();
    }
  });

  app.put("/accounts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleAccountUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const releaseOperation = claimNoodleOperation("identity");
    if (!releaseOperation) return reply.code(409).send({ error: NOODLE_IDENTITY_LOCK_BUSY });
    try {
      const updated = await noodle.updateAccount(id, parsed.data);
      if (!updated) return reply.code(404).send({ error: "Noodle account not found" });
      return updated;
    } catch (error) {
      if (isFileUniqueConstraintError(error, "noodle_accounts", ["handle"])) {
        return reply.code(409).send({ code: "NOODLE_HANDLE_TAKEN", error: "That Noodle handle is already in use." });
      }
      throw error;
    } finally {
      releaseOperation();
    }
  });

  app.put("/accounts/:id/profile", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleAccountProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const releaseOperation = claimNoodleOperation("identity");
    if (!releaseOperation) return reply.code(409).send({ error: NOODLE_IDENTITY_LOCK_BUSY });
    try {
      const existing = await noodle.getAccountById(id);
      if (!existing) return reply.code(404).send({ error: "Noodle account not found" });
      const sourceCharacter = existing.kind === "character" ? await characters.getById(existing.entityId) : null;
      const avatarCrop = resolveNoodleAvatarCropAfterProfileUpdate({
        currentAvatarUrl: existing.avatarUrl,
        nextAvatarUrl: parsed.data.avatarUrl,
        currentCrop: existing.avatarCrop,
        sourceAvatarUrl: sourceCharacter?.avatarPath,
        sourceCrop: sourceCharacter ? characterAvatarCrop(sourceCharacter) : null,
      });
      const profileFieldsChanged =
        (existing.kind === "character" || isAmbientNoodleAccount(existing)) &&
        (parsed.data.handle !== undefined ||
          parsed.data.displayName !== undefined ||
          parsed.data.bio !== undefined ||
          parsed.data.avatarUrl !== undefined);
      const updated = await noodle.updateAccountProfile(id, {
        ...parsed.data,
        ...((profileFieldsChanged || parsed.data.profile) && {
          profile: {
            ...parsed.data.profile,
            ...(profileFieldsChanged && avatarCrop !== undefined ? { avatarCrop } : {}),
            ...(profileFieldsChanged ? { profileManuallyEdited: true } : {}),
          },
        }),
      });
      if (!updated) return reply.code(404).send({ error: "Noodle account not found" });
      return updated;
    } catch (error) {
      if (isFileUniqueConstraintError(error, "noodle_accounts", ["handle"])) {
        return reply.code(409).send({ code: "NOODLE_HANDLE_TAKEN", error: "That Noodle handle is already in use." });
      }
      throw error;
    } finally {
      releaseOperation();
    }
  });

  app.patch("/accounts/:id/settings", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleAccountSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = await noodle.patchAccountSettings(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "Noodle account not found" });
    return updated;
  });

  app.get("/noodler/auto-post/status", async (_req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    return noodle.getNoodlerReserveStatus();
  });

  // Manual test trigger: runs one automatic-style post immediately, the same way the
  // scheduler does (locked access, no guide), without waiting for the next cadence
  // schedule or requiring auto-posting to be enabled.
  app.post("/noodler/accounts/:id/auto-post/run-now", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const { id } = req.params as { id: string };
    try {
      const result = await generateAndApplyNoodlerPost(app.db, {
        mode: "noodler",
        targetAccountId: id,
        access: "locked",
      });
      // Run-now never sets reviewImagePromptsBeforeSend, so the generator can only return a
      // plain post here — no image-prompt review is ever produced on this path.
      if (result.status === "generated") return result.post;
      if (result.status === "busy") {
        return reply.code(409).send({ error: "A generation for this NoodleR account is already running." });
      }
      if (result.status === "connection_required") {
        return reply.code(400).send({ error: "Select a Noodle generation connection first." });
      }
      if (result.status === "connection_not_found") {
        return reply.code(404).send({ error: "Noodle generation connection not found" });
      }
      return reply.code(404).send({ error: "NoodleR account not found." });
    } catch (error) {
      logger.error(error, "[noodler] Manual run-now failed");
      return reply.code(500).send({ error: getErrorMessage(error) });
    }
  });

  // Global manual trigger: runs every automation-enabled creator (prioritizing those
  // scheduled soonest), consuming each selected creator's near-future slot the same way
  // an automatic run would. One creator's failure does not affect the others.
  app.post("/noodler/auto-post/refresh-now", async (_req, reply) => {
    const result = await refreshAllNoodlerCreatorsNow(app.db);
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    return { outcomes: result.outcomes };
  });

  app.post("/noodler/auto-post/refresh-targeted", async (req, reply) => {
    const parsed = noodlerTargetedRefreshSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await refreshTargetedNoodlerCreatorsNow(app.db, parsed.data.accountIds, parsed.data.executionId);
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    return { outcomes: result.outcomes };
  });

  app.patch("/accounts/:id/follows/:targetAccountId", async (req, reply) => {
    const { id, targetAccountId } = req.params as { id: string; targetAccountId: string };
    if (id === targetAccountId) return reply.code(400).send({ error: "A Noodle account cannot follow itself" });
    const parsed = noodleAccountFollowUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [account, target] = await Promise.all([noodle.getAccountById(id), noodle.getAccountById(targetAccountId)]);
    if (!account || !target) return reply.code(404).send({ error: "Noodle account not found" });
    const updated = await noodle.updateAccountFollow(id, targetAccountId, parsed.data.followed);
    if (!updated) return reply.code(404).send({ error: "Noodle account not found" });
    return updated.account;
  });

  app.post("/invites", async (req, reply) => {
    const parsed = noodleInviteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const row = await characters.getById(parsed.data.characterId);
    if (!row) return reply.code(404).send({ error: "Character not found" });
    const name = characterNameFromRow(row);
    return noodle.upsertAccountFromProfile({
      kind: "character",
      entityId: row.id,
      displayName: name,
      avatarUrl: row.avatarPath ?? null,
      avatarCrop: characterAvatarCrop(row),
      bio: String(parseRecord(row.data).description ?? ""),
      invited: true,
      syncIdentity: true,
    });
  });

  app.post("/invites/bulk", async (req, reply) => {
    const parsed = noodleBulkInviteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const uniqueCharacterIds = Array.from(new Set(parsed.data.characterIds));
    const accounts: NoodleAccount[] = [];
    for (const characterId of uniqueCharacterIds) {
      const row = await characters.getById(characterId);
      if (!row) continue;
      accounts.push(
        await noodle.upsertAccountFromProfile({
          kind: "character",
          entityId: row.id,
          displayName: characterNameFromRow(row),
          avatarUrl: row.avatarPath ?? null,
          avatarCrop: characterAvatarCrop(row),
          bio: String(parseRecord(row.data).description ?? ""),
          invited: true,
          syncIdentity: true,
        }),
      );
    }
    return accounts;
  });

  app.delete("/invites", async () => {
    await Promise.all([
      noodle.clearCharacterInvites(),
      noodle.updateSettings({ invitedCharacterGroupIds: [], allowRandomUsers: false }),
    ]);
    return bootstrapVisibleNoodle(noodle, characters);
  });

  app.delete("/invites/:characterId", async (req, reply) => {
    const { characterId } = req.params as { characterId: string };
    const account = await noodle.setCharacterInvited(characterId, false);
    if (!account) return reply.code(404).send({ error: "Noodle character account not found" });
    return account;
  });

  app.post("/posts", async (req, reply) => {
    if (req.body && typeof req.body === "object" && "title" in req.body) {
      return reply.code(400).send({ error: "Public Noodle posts do not support titles." });
    }
    const parsed = noodleCreatePostSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let account = await noodle.getAccountByEntity(parsed.data.authorKind, parsed.data.authorEntityId);
    if (!account && parsed.data.authorKind === "persona") {
      account = await resolvePersonaAccount(noodle, characters, parsed.data.authorEntityId);
    }
    if (!account) return reply.code(404).send({ error: "Noodle account not found" });
    const mentionedAccounts = mentionedCharacterAccounts(await noodle.listAccounts(), parsed.data.content);
    const poll = parsed.data.poll ? createNoodlePoll(parsed.data.poll) : null;
    const post = await noodle.createPost({
      authorAccountId: account.id,
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl ?? null,
      imagePrompt: parsed.data.imagePrompt ?? null,
      parentPostId: parsed.data.parentPostId ?? null,
      quotePostId: parsed.data.quotePostId ?? null,
      source: "manual",
      metadata: {
        ...mentionedAccountMetadata(mentionedAccounts),
        ...(poll ? { poll } : {}),
        ...(parsed.data.imageCrop ? { imageCrop: parsed.data.imageCrop } : {}),
      },
    });
    if (!post) return reply.code(404).send({ error: "Noodle author not found" });
    const digest = await noodle.createDigest({
      accountIds: [account.id, ...mentionedAccounts.map((mentionedAccount) => mentionedAccount.id)],
      content: `${noodleDigestAccountLabel(account)} posted on Noodle: ${post.content}`,
      sourcePostId: post.id,
    });
    return (await noodle.updatePostMedia(post.id, { metadata: { activityDigestId: digest.id } })) ?? post;
  });

  app.patch("/posts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (req.body && typeof req.body === "object" && "title" in req.body) {
      return reply.code(400).send({ error: "Public Noodle posts do not support titles." });
    }
    const parsed = noodlePostUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const existing = await noodle.getPostById(id);
    if (!existing) return reply.code(404).send({ error: "Noodle post not found" });
    const nextContent = parsed.data.content === undefined ? existing.content : parsed.data.content;
    const nextPoll =
      parsed.data.poll === undefined
        ? readNoodlePollFromMetadata(existing.metadata)
        : parsed.data.poll
          ? createNoodlePoll(parsed.data.poll)
          : null;
    if (!nextContent.trim() && !nextPoll) {
      return reply.code(400).send({ error: "Posts need a body or poll." });
    }
    let post = await noodle.updatePost(id, parsed.data);
    if (!post) return reply.code(404).send({ error: "Noodle post not found" });
    if (parsed.data.content !== undefined || parsed.data.poll !== undefined) {
      const mentionedAccounts = mentionedCharacterAccounts(await noodle.listAccounts(), post.content);
      post =
        (await noodle.updatePostMedia(post.id, {
          metadata: mentionedAccountMetadata(mentionedAccounts),
        })) ?? post;
      const digestId = post.metadata.activityDigestId;
      const author = await noodle.getAccountById(post.authorAccountId);
      const poll = readNoodlePollFromMetadata(post.metadata);
      const digestContent = post.content.trim() || poll?.question || "Shared a poll.";
      if (typeof digestId === "string" && digestId && author) {
        await noodle.updateDigest(digestId, {
          accountIds: [author.id, ...mentionedAccounts.map((mentionedAccount) => mentionedAccount.id)],
          content: `${noodleDigestAccountLabel(author)} posted on Noodle: ${digestContent}`,
        });
      }
    }
    return post;
  });

  app.delete("/posts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await noodle.deletePost(id);
    if (!deleted) return reply.code(404).send({ error: "Noodle post not found" });
    return deleted;
  });

  app.delete("/timeline", async () => {
    await noodle.resetTimeline();
    return bootstrapVisibleNoodle(noodle, characters);
  });

  app.post("/posts/:id/interactions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleCreateInteractionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let actor = await noodle.getAccountByEntity(parsed.data.actorKind, parsed.data.actorEntityId);
    if (!actor && parsed.data.actorKind === "persona") {
      actor = await resolvePersonaAccount(noodle, characters, parsed.data.actorEntityId);
    }
    if (!actor) return reply.code(404).send({ error: "Noodle actor not found" });
    const post = await noodle.getPostById(id);
    if (!post) return reply.code(404).send({ error: "Noodle post not found" });
    if (parsed.data.type === "vote") {
      const poll = readNoodlePollFromMetadata(post.metadata);
      if (!poll || !poll.options.some((option) => option.id === parsed.data.content?.trim())) {
        return reply.code(400).send({ error: "Choose a valid option from this poll." });
      }
    }
    const interaction = await noodle.createInteraction(id, {
      actorAccountId: actor.id,
      type: parsed.data.type,
      content: parsed.data.content ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(400).send({ error: "Could not add that Noodle interaction." });
    if (parsed.data.type !== "like") {
      const directReplyTarget = parsed.data.parentInteractionId
        ? (await noodle.listInteractions([id])).find((item) => item.id === parsed.data.parentInteractionId)
        : null;
      const poll = readNoodlePollFromMetadata(post.metadata);
      const selectedPollOption =
        parsed.data.type === "vote"
          ? poll?.options.find((option) => option.id === interaction.content)?.label
          : undefined;
      const interactionSummary =
        parsed.data.type === "vote" && poll && selectedPollOption
          ? `${poll.question}: ${selectedPollOption}`
          : interaction.content || (interaction.imageUrl ? "shared an image" : post.content);
      await noodle.createDigest({
        accountIds: Array.from(
          new Set([actor.id, post.authorAccountId, directReplyTarget?.actorAccountId].filter(Boolean) as string[]),
        ),
        content: `${noodleDigestAccountLabel(actor)} ${interactionDigestVerb(parsed.data.type)} a Noodle post: ${interactionSummary}`,
        sourcePostId: post.id,
        sourceInteractionId: interaction.id,
      });
    }
    return interaction;
  });

  app.patch("/posts/:postId/interactions/:interactionId", async (req, reply) => {
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const parsed = noodleInteractionUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const interaction = await noodle.getInteractionById(interactionId);
    if (!interaction || interaction.postId !== postId) {
      return reply.code(404).send({ error: "Noodle comment not found" });
    }
    await ensurePersonaAccounts(noodle, characters);
    const persona = await noodle.getAccountByEntity("persona", parsed.data.personaId);
    if (!persona) return reply.code(404).send({ error: "Noodle persona not found" });
    const interactionActor = await noodle.getAccountById(interaction.actorAccountId);
    const actorKind = interactionActor?.kind ?? interaction.actorSnapshot?.kind;
    if (
      interaction.type !== "reply" ||
      !canManageNoodleReply({
        actorKind,
        actorAccountId: interaction.actorAccountId,
        personaAccountId: persona.id,
      })
    ) {
      return reply.code(403).send({ error: "You can only edit comments from this persona or a character." });
    }
    const content = parsed.data.content === undefined ? interaction.content : parsed.data.content?.trim() || null;
    const imageUrl = parsed.data.imageUrl === undefined ? interaction.imageUrl : parsed.data.imageUrl?.trim() || null;
    if (!content && !imageUrl) return reply.code(400).send({ error: "Comments need text or an image." });
    const updated = await noodle.updateInteraction(interactionId, { content, imageUrl });
    if (!updated) return reply.code(404).send({ error: "Noodle comment not found" });
    const [post, accounts] = await Promise.all([noodle.getPostById(postId), noodle.listAccounts()]);
    if (post && interactionActor) {
      const directReplyTarget = updated.parentInteractionId
        ? await noodle.getInteractionById(updated.parentInteractionId)
        : null;
      const mentionedAccounts = mentionedCharacterAccounts(accounts, updated.content ?? "");
      await noodle.createDigest({
        accountIds: Array.from(
          new Set(
            [
              interactionActor.id,
              post.authorAccountId,
              directReplyTarget?.actorAccountId,
              ...mentionedAccounts.map((account) => account.id),
            ].filter(Boolean) as string[],
          ),
        ),
        content: `${noodleDigestAccountLabel(interactionActor)} replied to a Noodle post: ${
          updated.content || (updated.imageUrl ? "shared an image" : post.content)
        }`,
        sourcePostId: post.id,
        sourceInteractionId: updated.id,
      });
    }
    return updated;
  });

  app.delete("/posts/:postId/interactions/:interactionId", async (req, reply) => {
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const parsed = noodleInteractionOwnerSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const interaction = await noodle.getInteractionById(interactionId);
    if (!interaction || interaction.postId !== postId) {
      return reply.code(404).send({ error: "Noodle comment not found" });
    }
    await ensurePersonaAccounts(noodle, characters);
    const persona = await noodle.getAccountByEntity("persona", parsed.data.personaId);
    if (!persona) return reply.code(404).send({ error: "Noodle persona not found" });
    const interactionActor = await noodle.getAccountById(interaction.actorAccountId);
    const actorKind = interactionActor?.kind ?? interaction.actorSnapshot?.kind;
    if (
      interaction.type !== "reply" ||
      !canManageNoodleReply({
        actorKind,
        actorAccountId: interaction.actorAccountId,
        personaAccountId: persona.id,
      })
    ) {
      return reply.code(403).send({ error: "You can only delete comments from this persona or a character." });
    }
    const deleted = await noodle.deleteInteractionById(interactionId);
    if (deleted.length === 0) return reply.code(404).send({ error: "Noodle comment not found" });
    return deleted;
  });

  app.delete("/posts/:id/interactions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleRemoveInteractionSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let actor = await noodle.getAccountByEntity(parsed.data.actorKind, parsed.data.actorEntityId);
    if (!actor && parsed.data.actorKind === "persona") {
      actor = await resolvePersonaAccount(noodle, characters, parsed.data.actorEntityId);
    }
    if (!actor) return reply.code(404).send({ error: "Noodle actor not found" });
    const interaction = await noodle.deleteInteraction(id, {
      actorAccountId: actor.id,
      type: parsed.data.type,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(404).send({ error: "Noodle interaction not found" });
    return interaction;
  });

  app.post("/refresh/images", async (req, reply) => {
    const parsed = noodleImagePromptConfirmationSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await publicImages.generateReviewedImages({
      prompts: parsed.data.prompts,
      debugMode: parsed.data.debugMode === true,
    });
    if (!result.ok) return reply.code(400).send({ error: result.message });
    return result.bootstrap;
  });

  app.post("/noodler/refresh/images", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodleImagePromptConfirmationSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await noodlerImages.generateReviewedImages({
      prompts: parsed.data.prompts,
      debugMode: parsed.data.debugMode === true,
    });
    if (!result.ok) return reply.code(400).send({ error: result.message });
    return { finalized: result.finalized };
  });

  app.post("/refresh", async (req, reply) => {
    let decoded: DecodedNoodlerMediaRequest<
      z.output<typeof noodlerGenerationRequestSchema> | z.output<typeof noodleGenerationRequestSchema>
    >;
    try {
      decoded = await decodeNoodlerMediaRequest(req, {
        withMedia: noodlerGenerationRequestSchema,
        withoutMedia: noodleGenerationRequestSchema,
      });
    } catch (error) {
      return sendNoodlerMediaError(reply, error);
    }
    if (!decoded.success) return reply.code(400).send({ error: decoded.error.flatten() });
    if (decoded.data.mode === "noodler") {
      try {
        const result = await generateAndApplyNoodlerPost(
          app.db,
          decoded.data,
          decoded.media,
          admissionModeForRequest(req.headers),
        );
        if (result.status === "generated") {
          return result.imagePromptReview
            ? { ...result.post, imagePromptReview: result.imagePromptReview }
            : result.post;
        }
        if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
        if (result.status === "busy") {
          return reply.code(409).send({ error: "A generation for this NoodleR account is already running." });
        }
        if (result.status === "connection_required") {
          return reply.code(400).send({ error: "Select a Noodle generation connection first." });
        }
        if (result.status === "connection_not_found") {
          return reply.code(404).send({ error: "Noodle generation connection not found" });
        }
        return reply.code(404).send({ error: "NoodleR account not found." });
      } catch (error) {
        // The connection is busy with user work: 409 tells the scheduler to retry shortly
        // rather than record a configuration failure and back off for minutes.
        if (isConnectionAdmissionFailure(error)) {
          return reply.code(409).send({ error: getErrorMessage(error) });
        }
        logger.error(error, "[noodler] NoodleR post generation failed");
        return reply.code(500).send({ error: getErrorMessage(error) });
      }
    }
    const releaseOperation = claimNoodleOperation("identity");
    if (!releaseOperation) return reply.code(409).send({ error: NOODLE_IDENTITY_LOCK_BUSY });
    try {
      const settings = await noodle.getSettings();
      const connectionId = decoded.data.connectionId ?? settings.generationConnectionId;
      if (!connectionId) return reply.code(400).send({ error: "Select a Noodle generation connection first." });
      const conn = await connections.getWithKey(connectionId);
      if (!conn) return reply.code(404).send({ error: "Noodle generation connection not found" });
      const imageCaptioning = await resolveImageCaptioningRuntime({
        chatMeta: settings.imageCaptioningUseConnectionDefault
          ? {}
          : {
              imageCaptioningEnabled: settings.imageCaptioningEnabled,
              imageCaptioningConnectionId: settings.imageCaptioningConnectionId,
            },
        fallbackConnectionId: connectionId,
        connections,
      });
      const imageConnection = settings.enableImagePrompts
        ? settings.imageGenerationConnectionId
          ? await connections.getWithKey(settings.imageGenerationConnectionId)
          : await connections.getDefaultForImageGeneration()
        : null;
      if (settings.enableImagePrompts && !imageConnection) {
        return reply.code(400).send({ error: "Select a Noodle image generation connection first." });
      }
      const generated = await publicGeneration.generate({
        connection: conn,
        imageConnection,
        imageCaptioning,
        settings,
        personaId: decoded.data.personaId,
        timeZone: normalizePromptTimeZone(decoded.data.timeZone),
        debugMode: decoded.data.debugMode === true,
        reviewImagePromptsBeforeSend: decoded.data.reviewImagePromptsBeforeSend === true,
        admissionMode: admissionModeForRequest(req.headers),
      });
      if (!generated.ok) return reply.code(400).send({ error: generated.error });
      return generated.result;
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      return reply.code(500).send({ error: getErrorMessage(error) });
    } finally {
      releaseOperation();
    }
  });
}
