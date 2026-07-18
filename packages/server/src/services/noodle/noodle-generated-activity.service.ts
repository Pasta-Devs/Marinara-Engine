import {
  createNoodlePoll,
  readNoodlePollFromMetadata,
  type NoodleAccount,
  type NoodleGeneratedRefresh,
  type NoodleInteractionType,
  type NoodleSettings,
} from "@marinara-engine/shared";
import { basename } from "path";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createGalleryStorage } from "../storage/gallery.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { canCreateGeneratedNoodleInteraction } from "./noodle-interaction-policy.js";
import { normalizeNoodleHandle } from "./noodle-handle.js";
import { normalizeNoodleImagePrompt } from "./noodle-image-prompt.js";
import { canGenerateNoodleActivityForAccountKind } from "./noodle-prompt.js";
import { generateNoodlePostImage, type NoodleImagePromptReviewItem } from "./noodle-public-images.service.js";
import {
  getErrorMessage,
  interactionDigestVerb,
  mentionedAccountMetadata,
  mentionedCharacterAccounts,
  noodleDigestAccountLabel,
} from "./noodle-public-support.js";

type ImageConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

function galleryImageUrl(filePath: string, fallbackChatId: string) {
  const filename = basename(filePath.replace(/\\/g, "/"));
  return `/api/gallery/file/${encodeURIComponent(fallbackChatId)}/${encodeURIComponent(filename)}`;
}

function characterGalleryImageUrl(characterId: string, filePath: string) {
  const filename = basename(filePath.replace(/\\/g, "/"));
  return `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}`;
}

function sinceHoursIso(hours: number) {
  return new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000).toISOString();
}

async function pickGalleryAttachmentForAccount(input: {
  account: NoodleAccount;
  chats: ReturnType<typeof createChatsStorage>;
  gallery: ReturnType<typeof createGalleryStorage>;
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
}) {
  if (input.account.kind !== "character") return null;
  const characterImages = await input.characterGallery.listByCharacterId(input.account.entityId);
  const characterImage = characterImages[0];
  if (characterImage) {
    return {
      imageUrl: characterGalleryImageUrl(input.account.entityId, characterImage.filePath),
      metadata: { galleryAttachmentSource: "character-gallery", galleryAttachmentId: characterImage.id },
    };
  }
  const chats = await input.chats.list();
  const chatIds = chats
    .filter((chat) => parseStringArray(chat.characterIds).includes(input.account.entityId))
    .map((chat) => chat.id)
    .slice(0, 20);
  const chatImages = await input.gallery.listByChatIds(chatIds);
  const chatImage = chatImages[0];
  if (!chatImage) return null;
  return {
    imageUrl: galleryImageUrl(chatImage.filePath, chatImage.chatId),
    metadata: {
      galleryAttachmentSource: "chat-gallery",
      galleryAttachmentId: chatImage.id,
      galleryAttachmentChatId: chatImage.chatId,
    },
  };
}

export async function persistGeneratedNoodleActivity(input: {
  db: DB;
  noodle: ReturnType<typeof createNoodleStorage>;
  characters: ReturnType<typeof createCharactersStorage>;
  chats: ReturnType<typeof createChatsStorage>;
  gallery: ReturnType<typeof createGalleryStorage>;
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
  promptOverrides: ReturnType<typeof createPromptOverridesStorage>;
  generated: NoodleGeneratedRefresh;
  selectedParticipants: NoodleAccount[];
  personaAccount: NoodleAccount | null;
  settings: NoodleSettings;
  imageConnection: ImageConnection | null;
  debugMode: boolean;
  reviewImagePromptsBeforeSend: boolean;
  runId: string;
  recalledPostIds: string[];
}) {
  const activeAccounts = [...input.selectedParticipants, ...(input.personaAccount ? [input.personaAccount] : [])];
  const handleToAccount = new Map(
    [...(input.personaAccount ? [input.personaAccount] : []), ...input.selectedParticipants].map((account) => [
      normalizeNoodleHandle(account.handle),
      account,
    ]),
  );
  const freshPosts = await input.noodle.listPosts({ since: sinceHoursIso(48), limit: 200 });
  const allowedPostIds = new Set([...freshPosts.map((post) => post.id), ...input.recalledPostIds]);
  const existingInteractionById = new Map(
    (await input.noodle.listInteractions([...allowedPostIds])).map((interaction) => [
      interaction.id,
      interaction,
    ]),
  );
  const existingInteractions = [...existingInteractionById.values()];
  let remainingImagePrompts = input.settings.enableImagePrompts ? input.settings.maxImagesPerRefresh : 0;
  const tempIdToPostId = new Map<string, string>();
  const imagePromptReviewItems: NoodleImagePromptReviewItem[] = [];
  const activeCharacterReferenceAccounts = activeAccounts.filter((account) => account.kind === "character");

  for (const generatedPost of input.generated.posts.slice(0, input.settings.maxGeneratedPostsPerRefresh)) {
    const account = handleToAccount.get(normalizeNoodleHandle(generatedPost.authorHandle));
    if (!account) continue;
    if (!canGenerateNoodleActivityForAccountKind(account.kind)) {
      logger.warn("[noodle] Ignoring generated post attributed to persona %s", account.entityId);
      continue;
    }
    const imagePrompt = remainingImagePrompts > 0 ? normalizeNoodleImagePrompt(generatedPost.imagePrompt) : null;
    if (imagePrompt) remainingImagePrompts -= 1;
    let persistedImagePrompt = imagePrompt;
    let imageUrl: string | null = null;
    const mediaMetadata: Record<string, unknown> = {};
    let imageGenerationFailed = false;
    let imagePromptPreview: Omit<NoodleImagePromptReviewItem, "id"> | null = null;
    if (imagePrompt && input.imageConnection) {
      try {
        const generatedImage = await generateNoodlePostImage({
          account,
          referenceAccounts: activeCharacterReferenceAccounts,
          postContent: generatedPost.content,
          draftPrompt: imagePrompt,
          settings: input.settings,
          characters: input.characters,
          characterGallery: input.characterGallery,
          promptOverrides: input.promptOverrides,
          imageConnection: input.imageConnection,
          db: input.db,
          debugMode: input.debugMode,
          previewOnly: input.reviewImagePromptsBeforeSend === true,
        });
        imageUrl = generatedImage.imageUrl;
        Object.assign(mediaMetadata, generatedImage.metadata);
        imagePromptPreview = generatedImage.preview;
      } catch (err) {
        logger.warn(err, "[noodle] Failed to generate image for %s", account.displayName);
        persistedImagePrompt = null;
        imageGenerationFailed = true;
        mediaMetadata.imageGenerationFailed = true;
        mediaMetadata.imageGenerationError = getErrorMessage(err).slice(0, 500);
      }
    } else if (imagePrompt) {
      persistedImagePrompt = null;
      imageGenerationFailed = true;
      mediaMetadata.imageGenerationFailed = true;
      mediaMetadata.imageGenerationError = "No image generation connection is configured.";
    }
    if (
      !imageUrl &&
      !imagePromptPreview &&
      !imageGenerationFailed &&
      input.settings.allowGalleryImageAttachments &&
      generatedPost.attachGalleryImage === true
    ) {
      try {
        const attachment = await pickGalleryAttachmentForAccount({
          account,
          chats: input.chats,
          gallery: input.gallery,
          characterGallery: input.characterGallery,
        });
        if (attachment) {
          imageUrl = attachment.imageUrl;
          Object.assign(mediaMetadata, attachment.metadata);
        }
      } catch (err) {
        logger.warn(err, "[noodle] Failed to attach gallery image for %s", account.displayName);
      }
    }
    const mentionedAccounts = mentionedCharacterAccounts(activeAccounts, generatedPost.content);
    const poll = generatedPost.poll ? createNoodlePoll(generatedPost.poll) : null;
    const post = await input.noodle.createPost({
      authorAccountId: account.id,
      content: generatedPost.content,
      imagePrompt: persistedImagePrompt,
      imageUrl,
      source: "generated",
      metadata: {
        runId: input.runId,
        ...mediaMetadata,
        ...mentionedAccountMetadata(mentionedAccounts),
        ...(poll ? { poll } : {}),
      },
    });
    if (!post) continue;
    allowedPostIds.add(post.id);
    if (imagePromptPreview) imagePromptReviewItems.push({ id: post.id, ...imagePromptPreview });
    if (generatedPost.tempId) tempIdToPostId.set(generatedPost.tempId, post.id);
    const digest = await input.noodle.createDigest({
      accountIds: [account.id, ...mentionedAccounts.map((mentionedAccount) => mentionedAccount.id)],
      content: `${noodleDigestAccountLabel(account)} posted on Noodle: ${post.content}`,
      sourceRunId: input.runId,
      sourcePostId: post.id,
    });
    await input.noodle.updatePostMedia(post.id, { metadata: { activityDigestId: digest.id } });
  }

  const quotas: Record<NoodleInteractionType, number> = {
    like: input.settings.maxLikesPerRefresh,
    repost: input.settings.maxRepostsPerRefresh,
    reply: input.settings.maxRepliesPerRefresh,
    vote: input.settings.maxLikesPerRefresh,
  };
  for (const generatedInteraction of input.generated.interactions) {
    if (quotas[generatedInteraction.type] <= 0) continue;
    const actor = handleToAccount.get(normalizeNoodleHandle(generatedInteraction.actorHandle));
    if (!actor) continue;
    if (!canGenerateNoodleActivityForAccountKind(actor.kind)) {
      logger.warn(
        "[noodle] Ignoring generated %s interaction attributed to persona %s",
        generatedInteraction.type,
        actor.entityId,
      );
      continue;
    }
    const targetPostId =
      generatedInteraction.targetPostId ?? tempIdToPostId.get(generatedInteraction.targetTempId ?? "");
    if (!targetPostId || !allowedPostIds.has(targetPostId)) continue;
    const targetPost = await input.noodle.getPostById(targetPostId);
    if (!targetPost) continue;
    const parentInteraction = generatedInteraction.parentInteractionId
      ? (existingInteractionById.get(generatedInteraction.parentInteractionId) ?? null)
      : null;
    if (
      generatedInteraction.parentInteractionId &&
      (!parentInteraction || parentInteraction.postId !== targetPostId || parentInteraction.type !== "reply")
    )
      continue;
    if (!canCreateGeneratedNoodleInteraction({ actor, targetPost, parentInteraction, existingInteractions })) continue;
    const poll = readNoodlePollFromMetadata(targetPost.metadata);
    const selectedPollOption =
      generatedInteraction.type === "vote" ? poll?.options[generatedInteraction.pollOptionIndex ?? -1] : undefined;
    if (generatedInteraction.type === "vote" && !selectedPollOption) continue;
    const interaction = await input.noodle.createInteraction(targetPostId, {
      actorAccountId: actor.id,
      type: generatedInteraction.type,
      content: selectedPollOption?.id ?? generatedInteraction.content ?? null,
      parentInteractionId: parentInteraction?.id ?? null,
    });
    if (!interaction) continue;
    existingInteractions.push(interaction);
    existingInteractionById.set(interaction.id, interaction);
    quotas[generatedInteraction.type] -= 1;
    if (generatedInteraction.type !== "like") {
      const interactionSummary =
        generatedInteraction.type === "vote" && poll && selectedPollOption
          ? `${poll.question}: ${selectedPollOption.label}`
          : interaction.content || targetPost.content;
      await input.noodle.createDigest({
        accountIds: Array.from(
          new Set([actor.id, targetPost.authorAccountId, parentInteraction?.actorAccountId]),
        ).filter((accountId): accountId is string => Boolean(accountId)),
        content: `${noodleDigestAccountLabel(actor)} ${interactionDigestVerb(generatedInteraction.type)} a Noodle post: ${interactionSummary}`,
        sourceRunId: input.runId,
        sourcePostId: targetPostId,
        sourceInteractionId: interaction.id,
      });
    }
  }

  const maxGeneratedFollows = Math.max(12, activeAccounts.length * 2);
  const seenGeneratedFollows = new Set<string>();
  for (const generatedFollow of input.generated.follows.slice(0, maxGeneratedFollows)) {
    const actor = handleToAccount.get(normalizeNoodleHandle(generatedFollow.actorHandle));
    const target = handleToAccount.get(normalizeNoodleHandle(generatedFollow.targetHandle));
    if (!actor || !target || actor.id === target.id) continue;
    if (!canGenerateNoodleActivityForAccountKind(actor.kind)) {
      logger.warn("[noodle] Ignoring generated follow attributed to persona %s", actor.entityId);
      continue;
    }
    const followKey = `${actor.id}:${target.id}`;
    if (seenGeneratedFollows.has(followKey)) continue;
    seenGeneratedFollows.add(followKey);
    const follow = await input.noodle.updateAccountFollow(actor.id, target.id, true);
    if (!follow?.changed) continue;
    await input.noodle.createDigest({
      accountIds: [actor.id, target.id],
      content: `${noodleDigestAccountLabel(actor)} followed ${noodleDigestAccountLabel(target)} on Noodle.`,
      sourceRunId: input.runId,
    });
  }
  return { imagePromptReviewItems };
}
