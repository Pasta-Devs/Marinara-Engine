// ──────────────────────────────────────────────
// Routes: Noodle Fake Social Media
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createNoodlePoll,
  canManageNoodleReply,
  extractNoodleMentionHandles,
  noodleAccountFollowUpdateSchema,
  noodleAccountProfileUpdateSchema,
  noodleAccountSettingsPatchSchema,
  noodleAccountUpdateSchema,
  noodleBulkInviteSchema,
  noodleCreateInteractionSchema,
  noodleCreatePostSchema,
  noodleInviteSchema,
  noodleInteractionOwnerSchema,
  noodleInteractionUpdateSchema,
  noodlePostUpdateSchema,
  noodlePrivateAccountCreateSchema,
  noodlerCreateInteractionSchema,
  noodlerRemoveInteractionSchema,
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
  type NoodleInteractionType,
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

import { createPublicNoodleGenerationService } from "../services/noodle/noodle-public-generation.service.js";
import { createPublicNoodleImagesService } from "../services/noodle/noodle-public-images.service.js";
import {
  generatePrivatePost,
  stageProfileContainsPublicIdentity,
} from "../services/noodle/noodle-private-generation.service.js";
import { generateNoodlerStageProfileDraft } from "../services/noodle/noodle-stage-profile-draft.service.js";
import { canViewNoodlerPost, isNoodlerHiddenFromViewer } from "../services/noodle/noodler-access.js";
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

export async function noodleRoutes(app: FastifyInstance) {
  const noodle = createNoodleStorage(app.db);
  const characters = createCharactersStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const publicGeneration = createPublicNoodleGenerationService(app.db);
  const publicImages = createPublicNoodleImagesService(app.db);
  let refreshInFlight = false;
  const privateGenerationInFlight = new Set<string>();

  app.get("/", async () => {
    return bootstrapVisibleNoodle(noodle, characters);
  });

  app.put("/settings", async (req, reply) => {
    const parsed = noodleSettingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return noodle.updateSettings(parsed.data);
  });

  app.get("/noodler/accounts", async (_req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    return noodle.listNoodlerStageProfiles();
  });

  async function resolveViewerPersona(personaId: string) {
    const account = await noodle.getAccountByEntity("persona", personaId);
    return account?.visibility === "public" ? account : null;
  }

  app.get("/noodler/viewer", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Noodle persona not found" });
    const [accounts, profiles, subscriptions, unlocks] = await Promise.all([
      noodle.listPrivateAccounts(),
      noodle.listNoodlerStageProfiles(),
      noodle.listSubscriptionsForViewer(viewer.id),
      noodle.listPostUnlocksForViewer(viewer.id),
    ]);
    const subscribedIds = new Set(subscriptions.map((item) => item.creatorAccountId));
    const unlockedIds = new Set(unlocks.map((item) => item.postId));
    const profileById = new Map(
      profiles.map(({ access: _access, ...profile }) => [
        profile.id,
        {
          ...profile,
          publicAccountId: profile.disclosureMode === "open" ? profile.publicAccountId : null,
        },
      ]),
    );
    const visibleAccounts = accounts.filter(
      (account) => account.publicAccountId !== viewer.id && !isNoodlerHiddenFromViewer(account, viewer.id),
    );
    const postsByAccount = await noodle.listPrivatePostsByAccounts(
      visibleAccounts.map((account) => account.id),
      40,
    );
    const viewablePostIds = new Set<string>();
    for (const account of visibleAccounts) {
      const subscribed = subscribedIds.has(account.id);
      for (const post of postsByAccount.get(account.id) ?? []) {
        if (
          canViewNoodlerPost({
            post,
            subscribed,
            unlockedPostIds: unlockedIds,
            subscriptionIncludesPpv: account.settings.privacy.access.subscriptionIncludesPpv,
          })
        ) {
          viewablePostIds.add(post.id);
        }
      }
    }
    const interactionsByPostId = new Map<string, NoodlerPostView["interactions"]>();
    for (const interaction of await noodle.listPrivateInteractions([...viewablePostIds])) {
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
        posts: posts.map((post): NoodlerPostView => {
          const locked = !viewablePostIds.has(post.id);
          return {
            id: post.id,
            authorAccountId: post.authorAccountId,
            access: post.access,
            ppvPrice: post.ppvPrice,
            locked,
            content: locked ? null : post.content,
            imageUrl: locked ? null : post.imageUrl,
            imagePrompt: locked ? null : post.imagePrompt,
            metadata: locked ? null : post.metadata,
            createdAt: post.createdAt,
            interactions: locked ? [] : interactionsByPostId.get(post.id) ?? [],
          };
        }),
      };
    });
    return { viewer, creators };
  });

  async function resolveGatedPrivatePost(personaId: string, postId: string) {
    const viewer = await resolveViewerPersona(personaId);
    const post = viewer ? await noodle.getPrivatePostById(postId) : null;
    const creator = post ? await noodle.getPrivateAccountById(post.authorAccountId) : null;
    // Mirror the feed/subscribe/unlock rule: a viewer persona linked to the creator's own
    // public account is not an audience member and must not persist self-interactions.
    if (
      !viewer ||
      !post ||
      !creator ||
      creator.publicAccountId === viewer.id ||
      isNoodlerHiddenFromViewer(creator, viewer.id)
    )
      return null;
    const [subscriptions, unlocks] = await Promise.all([
      noodle.listSubscriptionsForViewer(viewer.id),
      noodle.listPostUnlocksForViewer(viewer.id),
    ]);
    const subscribed = subscriptions.some((item) => item.creatorAccountId === creator.id);
    const locked = !canViewNoodlerPost({
      post,
      subscribed,
      unlockedPostIds: new Set(unlocks.map((item) => item.postId)),
      subscriptionIncludesPpv: creator.settings.privacy.access.subscriptionIncludesPpv,
    });
    if (locked) return null;
    return { viewer, post };
  }

  app.post("/noodler/posts/:id/interactions", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerCreateInteractionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const gated = await resolveGatedPrivatePost(parsed.data.personaId, id);
    if (!gated) return reply.code(404).send({ error: "NoodleR post not found" });
    const interaction = await noodle.createPrivateInteraction(id, {
      actorAccountId: gated.viewer.id,
      type: parsed.data.type,
      content: parsed.data.content ?? null,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(400).send({ error: "Could not add that NoodleR interaction." });
    return reply.code(201).send(interaction);
  });

  app.delete("/noodler/posts/:id/interactions", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerRemoveInteractionSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const gated = await resolveGatedPrivatePost(parsed.data.personaId, id);
    if (!gated) return reply.code(404).send({ error: "NoodleR post not found" });
    const interaction = await noodle.deletePrivateInteraction(id, {
      actorAccountId: gated.viewer.id,
      type: parsed.data.type,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(404).send({ error: "NoodleR interaction not found" });
    return interaction;
  });

  // NoodleR posts are private stage-profile posts the user fully owns, so edit/delete
  // route through the private-only storage methods (getPrivatePostById) rather than the
  // public /posts endpoints, which reject any post whose author is not a public account.
  app.patch("/noodler/posts/:id", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlePostUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const post = await noodle.updatePrivatePost(id, parsed.data);
    if (!post) return reply.code(404).send({ error: "NoodleR post not found" });
    return post;
  });

  app.delete("/noodler/posts/:id", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const { id } = req.params as { id: string };
    const deleted = await noodle.deletePrivatePost(id);
    if (!deleted) return reply.code(404).send({ error: "NoodleR post not found" });
    return deleted;
  });

  app.post("/noodler/accounts/:id/subscribe", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const [viewer, creator] = await Promise.all([
      resolveViewerPersona(parsed.data.personaId),
      noodle.getPrivateAccountById(id),
    ]);
    if (
      !viewer ||
      !creator ||
      creator.publicAccountId === viewer.id ||
      isNoodlerHiddenFromViewer(creator, viewer.id)
    ) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    const subscription = await noodle.subscribe(viewer.id, creator.id);
    if (!subscription) return reply.code(400).send({ error: "Could not subscribe to this stage profile" });
    return reply.code(201).send(subscription);
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
    return { ok: true };
  });

  app.post("/noodler/posts/:id/unlock", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlerUnlockSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const [viewer, post] = await Promise.all([
      resolveViewerPersona(parsed.data.personaId),
      noodle.getPrivatePostById(id),
    ]);
    const creator = post ? await noodle.getPrivateAccountById(post.authorAccountId) : null;
    if (
      !viewer ||
      !post ||
      !creator ||
      post.access !== "ppv" ||
      creator.publicAccountId === viewer.id ||
      isNoodlerHiddenFromViewer(creator, viewer.id)
    ) {
      return reply.code(404).send({ error: "NoodleR post not found" });
    }
    const unlock = await noodle.unlockPost(viewer.id, post.id);
    if (!unlock) return reply.code(400).send({ error: "Could not unlock this post" });
    return reply.code(201).send(unlock);
  });

  app.get<{ Querystring: { limit?: string; offset?: string; search?: string; kind?: string } }>(
    "/noodler/eligible-accounts",
    async (req, reply) => {
      const settings = await noodle.getSettings();
      if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
      const [publicAccounts, privateAccounts] = await Promise.all([
        noodle.listAccounts(),
        noodle.listPrivateAccounts(),
      ]);
      const linkedIds = new Set(privateAccounts.flatMap((account) => account.publicAccountId ?? []));
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
      const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
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

  app.post("/accounts/:id/private", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodlePrivateAccountCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const publicAccount = await noodle.getAccountById(id);
    if (
      publicAccount &&
      stageProfileContainsPublicIdentity(parsed.data.stageProfile, {
        displayName: publicAccount.displayName,
        handle: publicAccount.handle,
      })
    ) {
      return reply.code(400).send({
        error: "Hinted and secret stage profiles cannot use the linked public name or handle.",
      });
    }
    try {
      const created = await noodle.createPrivateAccount(id, parsed.data.stageProfile);
      if (!created) return reply.code(404).send({ error: "Noodle account not found" });
      const profile = (await noodle.listNoodlerStageProfiles()).find((item) => item.id === created.id);
      if (!profile) throw new Error("Failed to load the created NoodleR stage profile.");
      return reply.code(201).send(profile);
    } catch (error) {
      if (isFileUniqueConstraintError(error, "noodle_accounts", ["publicAccountId"])) {
        return reply.code(409).send({ error: "A private account already exists for this Noodle account." });
      }
      throw error;
    }
  });

  app.put("/noodler/accounts/:id/stage-profile", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const parsed = noodleStageProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const privateAccount = await noodle.getPrivateAccountById(id);
    const publicAccount = privateAccount?.publicAccountId
      ? await noodle.getAccountById(privateAccount.publicAccountId)
      : null;
    if (
      publicAccount &&
      stageProfileContainsPublicIdentity(parsed.data, {
        displayName: publicAccount.displayName,
        handle: publicAccount.handle,
      })
    ) {
      return reply.code(400).send({
        error: "Hinted and secret stage profiles cannot use the linked public name or handle.",
      });
    }
    const updated = await noodle.updateNoodlerStageProfile(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "NoodleR stage profile not found" });
    const profile = (await noodle.listNoodlerStageProfiles()).find((item) => item.id === updated.id);
    if (!profile) throw new Error("Failed to load the updated NoodleR stage profile.");
    return profile;
  });

  app.delete("/noodler/accounts/:id", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const { id } = req.params as { id: string };
    const deleted = await noodle.deletePrivateAccount(id);
    if (!deleted) return reply.code(404).send({ error: "NoodleR stage profile not found" });
    return deleted;
  });

  app.get("/noodler/accounts/:id/posts", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!settings.enableNoodler) return reply.code(404).send({ error: "Not Found" });
    const { id } = req.params as { id: string };
    if (!(await noodle.getPrivateAccountById(id))) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    return noodle.listPrivatePostsByAccount(id, 40);
  });

  app.put("/refresh-schedule", async (req, reply) => {
    const parsed = noodleRescheduleRefreshSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (refreshInFlight) return reply.code(409).send({ error: "Wait for the current Noodle refresh to finish." });
    const at = new Date();
    const schedule = await noodle.ensureRefreshSchedule(at);
    try {
      const rescheduled = rescheduleNoodleRefreshTime(schedule, parsed.data.scheduledTime, parsed.data.time, at);
      await noodle.saveRefreshSchedule(rescheduled);
      return noodleRefreshSchedulerStatus(rescheduled, at);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Could not reschedule refresh." });
    }
  });

  app.put("/accounts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleAccountUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = await noodle.updateAccount(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "Noodle account not found" });
    return updated;
  });

  app.put("/accounts/:id/profile", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleAccountProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
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
      existing.kind === "character" &&
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
  });

  app.patch("/accounts/:id/settings", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleAccountSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = await noodle.patchAccountSettings(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "Noodle account not found" });
    return updated;
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
      metadata: { ...mentionedAccountMetadata(mentionedAccounts), ...(poll ? { poll } : {}) },
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
    const parsed = noodlePostUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let post = await noodle.updatePost(id, parsed.data);
    if (!post) return reply.code(404).send({ error: "Noodle post not found" });
    if (parsed.data.content !== undefined) {
      const mentionedAccounts = mentionedCharacterAccounts(await noodle.listAccounts(), post.content);
      post =
        (await noodle.updatePostMedia(post.id, {
          metadata: mentionedAccountMetadata(mentionedAccounts),
        })) ?? post;
      const digestId = post.metadata.activityDigestId;
      const author = await noodle.getAccountById(post.authorAccountId);
      if (typeof digestId === "string" && digestId && author) {
        await noodle.updateDigest(digestId, {
          accountIds: [author.id, ...mentionedAccounts.map((mentionedAccount) => mentionedAccount.id)],
          content: `${noodleDigestAccountLabel(author)} posted on Noodle: ${post.content}`,
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

  app.post("/refresh", async (req, reply) => {
    const parsed = noodleGenerationRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const settings = await noodle.getSettings();
    if (parsed.data.mode === "private" && !settings.enableNoodler) {
      return reply.code(404).send({ error: "Not Found" });
    }
    if (parsed.data.mode === "private" && privateGenerationInFlight.has(parsed.data.targetAccountId)) {
      return reply.code(409).send({ error: "A generation for this NoodleR account is already running." });
    }
    if (parsed.data.mode === "private") privateGenerationInFlight.add(parsed.data.targetAccountId);
    const connectionId = parsed.data.connectionId ?? settings.generationConnectionId;
    if (parsed.data.mode === "private") {
      try {
        if (!connectionId) {
          return reply.code(400).send({ error: "Select a Noodle generation connection first." });
        }
        const conn = await connections.getWithKey(connectionId);
        if (!conn) return reply.code(404).send({ error: "Noodle generation connection not found" });
        const generated = await generatePrivatePost(app.db, {
          request: parsed.data,
          connection: conn,
        });
        if (!generated.ok) return reply.code(404).send({ error: generated.message });
        return generated.post;
      } catch (error) {
        logger.error(error, "[noodler] Private post generation failed");
        return reply.code(500).send({ error: getErrorMessage(error) });
      } finally {
        privateGenerationInFlight.delete(parsed.data.targetAccountId);
      }
    }
    if (!connectionId) return reply.code(400).send({ error: "Select a Noodle generation connection first." });
    const conn = await connections.getWithKey(connectionId);
    if (!conn) return reply.code(404).send({ error: "Noodle generation connection not found" });
    const imageCaptioning = await resolveImageCaptioningRuntime({
      chatMeta: {
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
    if (refreshInFlight) {
      return reply.code(409).send({ error: "A Noodle timeline refresh is already running." });
    }
    refreshInFlight = true;

    try {
      const generated = await publicGeneration.generate({
        connection: conn,
        imageConnection,
        imageCaptioning,
        settings,
        personaId: parsed.data.personaId,
        timeZone: normalizePromptTimeZone(parsed.data.timeZone),
        debugMode: parsed.data.debugMode === true,
        reviewImagePromptsBeforeSend: parsed.data.reviewImagePromptsBeforeSend === true,
      });
      if (!generated.ok) return reply.code(400).send({ error: generated.error });
      return generated.result;
    } catch (error) {
      return reply.code(500).send({ error: getErrorMessage(error) });
    } finally {
      refreshInFlight = false;
    }
  });
}
