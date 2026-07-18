import { existsSync, readFileSync } from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  PROFESSOR_MARI_ID,
  type NoodleAccount,
  type NoodleBootstrap,
  type NoodleSettings,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { newId } from "../../utils/id-generator.js";
import { resolveImageConnectionFallback } from "../generation/media-connection-fallback.js";
import { generateImage, stageImageToDisk, type StagedGalleryImage } from "../image/image-generation.js";
import { resolveConnectionImageDefaults } from "../image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../image/image-generation-settings.js";
import { compileImagePrompt } from "../image/image-prompt-compiler.js";
import { resolveImagePromptReviewSize } from "../image/image-prompt-review.js";
import {
  normalizeIllustratorAppearance,
  readIllustratorAppearance,
  resolveIllustratorCharacterReferences,
} from "../image/illustrator-references.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { loadPrompt, NOODLE_IMAGE_POST } from "../prompt-overrides/index.js";
import { generateNoodleImageWithRetry } from "./noodle-image-retry.js";
import { bootstrapVisibleNoodle, characterNameFromRow, getErrorMessage, parseRecord } from "./noodle-public-support.js";

type ImageConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export type NoodleImagePromptReviewItem = {
  id: string;
  kind: "illustration";
  title: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
};

export type ReviewedNoodleImagePrompt = Pick<NoodleImagePromptReviewItem, "id" | "prompt" | "negativePrompt">;

export type StagedNoodlePostMedia = {
  file: StagedGalleryImage;
  characterGalleryInput?: {
    characterId: string;
    filePath: string;
    prompt: string;
    provider: string;
    model: string;
    width: number;
    height: number;
  };
};

const NOODLE_SERVICE_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_PUBLIC_DIR = resolve(NOODLE_SERVICE_DIR, "../../../../client/public");
const PROFESSOR_MARI_REFERENCE_ASSETS = [
  "sprites/mari/Mari_profile.png",
  "sprites/mari/chibi-professor-mari.png",
] as const;
const REVIEWED_IMAGE_CLAIM_LEASE_MS = 2 * 60 * 1000;
const REVIEWED_IMAGE_CLAIM_RENEW_MS = 30 * 1000;

function imageClaimLeaseUntil() {
  return new Date(Date.now() + REVIEWED_IMAGE_CLAIM_LEASE_MS).toISOString();
}

function readProfessorMariReferenceImages(): string[] {
  return PROFESSOR_MARI_REFERENCE_ASSETS.flatMap((relativePath) => {
    const filePath = resolve(CLIENT_PUBLIC_DIR, relativePath);
    if (!existsSync(filePath)) return [];
    try {
      return [readFileSync(filePath).toString("base64")];
    } catch {
      return [];
    }
  });
}

export function characterAppearanceFromRow(row: { data: unknown }) {
  const data = parseRecord(row.data);
  return readIllustratorAppearance(data) ?? normalizeIllustratorAppearance(data.description) ?? "";
}

function galleryImageUrl(filePath: string, fallbackChatId: string) {
  const filename = basename(filePath.replace(/\\/g, "/"));
  return `/api/gallery/file/${encodeURIComponent(fallbackChatId)}/${encodeURIComponent(filename)}`;
}

function characterGalleryImageUrl(characterId: string, filePath: string) {
  const filename = basename(filePath.replace(/\\/g, "/"));
  return `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}`;
}

export async function generateNoodlePostImage(input: {
  account: NoodleAccount;
  referenceAccounts: NoodleAccount[];
  postContent: string;
  draftPrompt: string;
  settings: NoodleSettings;
  characters: ReturnType<typeof createCharactersStorage>;
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
  promptOverrides: ReturnType<typeof createPromptOverridesStorage>;
  imageConnection: ImageConnection;
  db: DB;
  debugMode: boolean;
  previewOnly?: boolean;
  promptOverride?: { prompt: string; negativePrompt?: string };
}) {
  const imageSettings = await loadImageGenerationUserSettings(input.db);
  const imageDefaults = resolveConnectionImageDefaults(input.imageConnection);
  const imageModel = input.imageConnection.model || "";
  const imageBaseUrl = input.imageConnection.baseUrl || "https://image.pollinations.ai";
  const imageSource = input.imageConnection.imageGenerationSource || imageModel;
  const imageServiceHint = input.imageConnection.imageService || imageSource;
  const imageFallback = await resolveImageConnectionFallback(
    createConnectionsStorage(input.db),
    input.imageConnection.id,
  );
  let characterDescription = "";
  let referenceImages: string[] | undefined;

  if (
    input.account.kind === "character" &&
    (input.settings.imageGenerationIncludeDescriptions || input.settings.imageGenerationUseAvatarReferences)
  ) {
    const character = await input.characters.getById(input.account.entityId);
    if (character) {
      const referenceAccountByEntityId = new Map(
        [input.account, ...input.referenceAccounts]
          .filter((account) => account.kind === "character")
          .map((account) => [account.entityId, account]),
      );
      const referenceRows = await Promise.all(
        Array.from(referenceAccountByEntityId.keys()).map((characterId) => input.characters.getById(characterId)),
      );
      const chatCharacters = referenceRows
        .filter((row): row is NonNullable<typeof row> => !!row)
        .map((row) => {
          const account = referenceAccountByEntityId.get(row.id);
          return {
            id: row.id,
            name: account?.displayName || characterNameFromRow(row),
            avatarPath: row.avatarPath ?? null,
            appearance: characterAppearanceFromRow(row),
          };
        });
      const referenceResolution = await resolveIllustratorCharacterReferences({
        charactersStore: input.characters,
        chatCharacters,
        persona: null,
        requestedNames: [input.account.displayName],
        promptText: [input.account.displayName, input.postContent, input.draftPrompt].join("\n"),
        maxReferences: 6,
      });
      if (input.settings.imageGenerationIncludeDescriptions && referenceResolution.appearanceBlock) {
        characterDescription = referenceResolution.appearanceBlock;
      }
      if (input.settings.imageGenerationUseAvatarReferences) {
        const builtInMariReferences =
          input.account.entityId === PROFESSOR_MARI_ID ? readProfessorMariReferenceImages() : [];
        const combinedReferences = [...builtInMariReferences, ...referenceResolution.referenceImages];
        if (combinedReferences.length > 0) referenceImages = Array.from(new Set(combinedReferences)).slice(0, 6);
      }
    }
  }

  const postPrompt = await loadPrompt(input.promptOverrides, NOODLE_IMAGE_POST, {
    authorName: input.account.displayName,
    postContent: input.postContent,
    draftPrompt: input.draftPrompt,
    userInstructions: input.settings.imageGenerationPrompt,
    characterDescription,
  });
  const compiledPrompt = compileImagePrompt({
    kind: "illustration",
    prompt: postPrompt,
    styleProfiles: imageSettings.styleProfiles,
    imageDefaults,
  });
  const finalPrompt = input.promptOverride?.prompt.trim() || compiledPrompt.prompt;
  const finalNegativePrompt = input.promptOverride
    ? input.promptOverride.negativePrompt?.trim() || undefined
    : compiledPrompt.negativePrompt || undefined;
  logDebugOverride(
    input.debugMode,
    "[debug/noodle/image] final image prompt for %s:\n%s",
    input.account.displayName,
    finalPrompt,
  );
  if (finalNegativePrompt) {
    logDebugOverride(input.debugMode, "[debug/noodle/image] negative prompt:\n%s", finalNegativePrompt);
  }

  if (input.previewOnly) {
    const previewSize = resolveImagePromptReviewSize({
      connection: input.imageConnection,
      prompt: finalPrompt,
      width: imageSettings.illustration.width,
      height: imageSettings.illustration.height,
      imageDefaults,
    });
    return {
      imageUrl: null,
      metadata: {},
      preview: {
        kind: "illustration" as const,
        title: `${input.account.displayName} Noodle image`,
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        width: previewSize.width,
        height: previewSize.height,
      },
      stagedMedia: null,
    };
  }

  const image = await generateNoodleImageWithRetry(
    () =>
      generateImage(imageSource, imageBaseUrl, input.imageConnection.apiKey || "", imageServiceHint, {
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        model: imageModel,
        width: imageSettings.illustration.width,
        height: imageSettings.illustration.height,
        imageEndpointId: input.imageConnection.imageEndpointId || undefined,
        comfyWorkflow: input.imageConnection.comfyuiWorkflow || undefined,
        imageDefaults,
        referenceImages,
        debugMode: input.debugMode,
        fallback: imageFallback,
      }),
    (error, attempt, maxAttempts) => {
      logger.warn(
        error,
        "[noodle] Image generation attempt %d/%d failed for %s",
        attempt,
        maxAttempts,
        input.account.displayName,
      );
    },
  );
  const provider = input.imageConnection.provider ?? "image_generation";
  const file = stageImageToDisk(
    input.account.kind === "character" ? `characters/${input.account.entityId}` : "noodle",
    image.base64,
    image.ext,
  );
  if (input.account.kind === "character") {
    return {
      imageUrl: characterGalleryImageUrl(input.account.entityId, file.filePath),
      metadata: {
        imageGenerated: true,
        imageProvider: provider,
        imageModel: imageModel || "unknown",
        imageStyleProfileId: compiledPrompt.profile.id,
      },
      preview: null,
      stagedMedia: {
        file,
        characterGalleryInput: {
          characterId: input.account.entityId,
          filePath: file.filePath,
          prompt: finalPrompt,
          provider,
          model: imageModel || "unknown",
          width: imageSettings.illustration.width,
          height: imageSettings.illustration.height,
        },
      } satisfies StagedNoodlePostMedia,
    };
  }
  return {
    imageUrl: galleryImageUrl(file.filePath, "noodle"),
    metadata: {
      imageGenerated: true,
      imageProvider: provider,
      imageModel: imageModel || "unknown",
      imageStyleProfileId: compiledPrompt.profile.id,
    },
    preview: null,
    stagedMedia: { file } satisfies StagedNoodlePostMedia,
  };
}

export function createPublicNoodleImagesService(db: DB) {
  const noodle = createNoodleStorage(db);
  const characters = createCharactersStorage(db);
  const connections = createConnectionsStorage(db);
  const characterGallery = createCharacterGalleryStorage(db);
  const promptOverrides = createPromptOverridesStorage(db);

  return {
    async generateReviewedImages(input: {
      prompts: ReviewedNoodleImagePrompt[];
      debugMode: boolean;
    }): Promise<
      { ok: true; bootstrap: NoodleBootstrap } | { ok: false; error: "missing_connection"; message: string }
    > {
      const settings = await noodle.getSettings();
      const imageConnection = settings.imageGenerationConnectionId
        ? await connections.getWithKey(settings.imageGenerationConnectionId)
        : await connections.getDefaultForImageGeneration();
      if (!imageConnection) {
        return {
          ok: false,
          error: "missing_connection",
          message: "Select a Noodle image generation connection first.",
        };
      }

      for (const promptOverride of input.prompts) {
        const claimToken = newId();
        const post = await noodle.claimPostImage(promptOverride.id, claimToken, imageClaimLeaseUntil());
        if (!post) continue;
        const account = await noodle.getAccountById(post.authorAccountId);
        if (!account) {
          await noodle.releasePostImageClaim(post.id, claimToken);
          continue;
        }
        let claimOwned = true;
        const renewClaim = async () => {
          if (!claimOwned) return;
          try {
            claimOwned = await noodle.renewPostImageClaim(post.id, claimToken, imageClaimLeaseUntil());
          } catch (error) {
            claimOwned = false;
            logger.warn(error, "[noodle] Failed to renew reviewed image claim for post %s", post.id);
          }
        };
        const renewalTimer = setInterval(() => void renewClaim(), REVIEWED_IMAGE_CLAIM_RENEW_MS);
        renewalTimer.unref?.();
        let generatedImage: Awaited<ReturnType<typeof generateNoodlePostImage>>;
        try {
          generatedImage = await generateNoodlePostImage({
            account,
            referenceAccounts: [account],
            postContent: post.content,
            draftPrompt: post.imagePrompt!,
            settings,
            characters,
            characterGallery,
            promptOverrides,
            imageConnection,
            db,
            debugMode: input.debugMode,
            promptOverride,
          });
        } catch (error) {
          logger.warn(error, "[noodle] Failed to generate reviewed image for %s", account.displayName);
          clearInterval(renewalTimer);
          await renewClaim();
          if (claimOwned) {
            await noodle.finalizePostImageClaim(post.id, claimToken, {
              imageUrl: null,
              imagePrompt: null,
              metadata: {
                imageGenerationFailed: true,
                imageGenerationError: getErrorMessage(error).slice(0, 500),
              },
            });
          }
          continue;
        }

        clearInterval(renewalTimer);
        await renewClaim();
        if (!claimOwned) {
          generatedImage.stagedMedia?.file.compensate();
          continue;
        }
        try {
          generatedImage.stagedMedia?.file.promote();
          await db.transaction(async (tx) => {
            const txNoodle = createNoodleStorage(tx);
            const txCharacterGallery = createCharacterGalleryStorage(tx);
            const galleryImage = generatedImage.stagedMedia?.characterGalleryInput
              ? await txCharacterGallery.create(generatedImage.stagedMedia.characterGalleryInput)
              : null;
            const finalized = await txNoodle.finalizePostImageClaim(post.id, claimToken, {
              imageUrl: generatedImage.imageUrl,
              metadata: {
                ...generatedImage.metadata,
                ...(galleryImage ? { characterGalleryImageId: galleryImage.id } : {}),
              },
            });
            if (!finalized) throw new Error("Reviewed Noodle image claim was lost during finalization.");
          });
        } catch (error) {
          generatedImage.stagedMedia?.file.compensate();
          try {
            await noodle.releasePostImageClaim(post.id, claimToken);
          } catch (releaseError) {
            logger.warn(releaseError, "[noodle] Failed to release reviewed image claim for post %s", post.id);
          }
          throw error;
        } finally {
          clearInterval(renewalTimer);
        }
      }
      return { ok: true, bootstrap: await bootstrapVisibleNoodle(noodle, characters) };
    },
  };
}
