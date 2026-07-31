import type { NoodleAccount, NoodleIdentityDisclosure, NoodleSettings } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { newId } from "../../utils/id-generator.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { getErrorMessage } from "./noodle-public-support.js";
import { NOODLER_MEDIA_PREFIX, noodlerPostMediaUrl } from "./noodle-noodler-media.js";
import { resolveImageConnectionFallback } from "../generation/media-connection-fallback.js";
import { generateImage, stageImageToDisk, type StagedGalleryImage } from "../image/image-generation.js";
import { resolveConnectionImageDefaults } from "../image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../image/image-generation-settings.js";
import { compileImagePrompt } from "../image/image-prompt-compiler.js";
import { resolveImagePromptReviewSize } from "../image/image-prompt-review.js";
import { resolveIllustratorCharacterReferences } from "../image/illustrator-references.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { loadPrompt, NOODLE_IMAGE_POST } from "../prompt-overrides/index.js";
import { generateNoodleImageWithRetry } from "./noodle-image-retry.js";
import { characterAppearanceFromRow, characterNoodleImageContextFromRow } from "./noodle-public-images.service.js";
import type { NoodleImagePromptReviewItem, ReviewedNoodleImagePrompt } from "./noodle-public-images.service.js";
import { characterNameFromRow } from "./noodle-public-support.js";
import type { ConnectionAdmissionMode } from "../generation/connection-admission.js";

const REVIEWED_IMAGE_CLAIM_LEASE_MS = 2 * 60 * 1000;
const REVIEWED_IMAGE_CLAIM_RENEW_MS = 30 * 1000;

function imageClaimLeaseUntil() {
  return new Date(Date.now() + REVIEWED_IMAGE_CLAIM_LEASE_MS).toISOString();
}

type ImageConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

/**
 * NoodleR analog of generateNoodlePostImage. The deliberate difference from public
 * Noodle: bytes stage into a NoodleR-owned media namespace and never touch the
 * public gallery or character gallery, so subscriber/PPV output can be served only
 * through the access-checked media endpoint. The staged file's on-disk path is persisted in
 * `metadata.noodlerMediaPath`; callers finalize via `stagedMedia` and derive the access-checked
 * URL from the persisted post id.
 */
export async function generateNoodlerPostImage(input: {
  account: NoodleAccount;
  linkedPublicAccount: NoodleAccount | null;
  disclosureMode: NoodleIdentityDisclosure;
  postContent: string;
  draftPrompt: string;
  settings: NoodleSettings;
  characters: ReturnType<typeof createCharactersStorage>;
  promptOverrides: ReturnType<typeof createPromptOverridesStorage>;
  imageConnection: ImageConnection;
  db: DB;
  debugMode: boolean;
  previewOnly?: boolean;
  promptOverride?: { prompt: string; negativePrompt?: string };
  beforeProviderAttempt?: (attempt: number) => Promise<void>;
  onProviderAttemptFailure?: (attempt: number) => Promise<void>;
  admissionMode?: ConnectionAdmissionMode;
}): Promise<{
  metadata: Record<string, unknown>;
  preview: Omit<NoodleImagePromptReviewItem, "id"> | null;
  stagedMedia: StagedGalleryImage | null;
}> {
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
  let characterImageInstructions = "";
  let characterPersonality = "";
  let referenceImages: string[] | undefined;
  // Identity protection applies to reference selection: only an OPEN disclosure may draw
  // on the linked public identity's appearance. Hinted/secret creators get no identifying
  // reference material.
  const referenceCharacter =
    input.disclosureMode === "open" && input.linkedPublicAccount?.kind === "character"
      ? input.linkedPublicAccount
      : null;
  if (referenceCharacter) {
    const row = await input.characters.getById(referenceCharacter.entityId);
    if (row) {
      const imageContext = characterNoodleImageContextFromRow(row);
      characterPersonality = imageContext.personality;
      characterImageInstructions = imageContext.imageInstructions;

      if (input.settings.imageGenerationIncludeDescriptions || input.settings.imageGenerationUseAvatarReferences) {
        const referenceResolution = await resolveIllustratorCharacterReferences({
          charactersStore: input.characters,
          chatCharacters: [
            {
              id: row.id,
              name: referenceCharacter.displayName || characterNameFromRow(row),
              avatarPath: row.avatarPath ?? null,
              appearance: characterAppearanceFromRow(row),
            },
          ],
          persona: null,
          requestedNames: [input.account.displayName],
          promptText: [input.account.displayName, input.postContent, input.draftPrompt].join("\n"),
          maxReferences: 6,
        });
        if (input.settings.imageGenerationIncludeDescriptions && referenceResolution.appearanceBlock) {
          characterDescription = referenceResolution.appearanceBlock;
        }
        if (input.settings.imageGenerationUseAvatarReferences && referenceResolution.referenceImages.length > 0) {
          referenceImages = Array.from(new Set(referenceResolution.referenceImages)).slice(0, 6);
        }
      }
    }
  }

  const postPrompt = await loadPrompt(input.promptOverrides, NOODLE_IMAGE_POST, {
    authorName: input.account.displayName,
    postContent: input.postContent,
    draftPrompt: input.draftPrompt,
    userInstructions: input.settings.imageGenerationPrompt,
    characterDescription,
    characterImageInstructions,
    characterPersonality,
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
    "[debug/noodler/image] final image prompt for %s:\n%s",
    input.account.displayName,
    finalPrompt,
  );

  if (input.previewOnly) {
    const previewSize = resolveImagePromptReviewSize({
      connection: input.imageConnection,
      prompt: finalPrompt,
      width: imageSettings.illustration.width,
      height: imageSettings.illustration.height,
      imageDefaults,
    });
    return {
      metadata: {},
      preview: {
        kind: "illustration",
        title: `${input.account.displayName} NoodleR image`,
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        width: previewSize.width,
        height: previewSize.height,
      },
      stagedMedia: null,
    };
  }

  const image = await generateNoodleImageWithRetry(
    async (attempt) => {
      await input.beforeProviderAttempt?.(attempt);
      return generateImage(imageSource, imageBaseUrl, input.imageConnection.apiKey || "", imageServiceHint, {
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
        admissionMode: input.admissionMode,
        fallback: imageFallback,
      });
    },
    async (error, attempt, maxAttempts) => {
      await input.onProviderAttemptFailure?.(attempt);
      logger.warn(
        error,
        "[noodler] Image generation attempt %d/%d failed for %s",
        attempt,
        maxAttempts,
        input.account.displayName,
      );
    },
  );
  const provider = input.imageConnection.provider ?? "image_generation";
  const file = stageImageToDisk(`${NOODLER_MEDIA_PREFIX}${input.account.id}`, image.base64, image.ext);
  return {
    metadata: {
      imageGenerated: true,
      imageProvider: provider,
      imageModel: imageModel || "unknown",
      imageStyleProfileId: compiledPrompt.profile.id,
      noodlerMediaPath: file.filePath,
    },
    preview: null,
    stagedMedia: file,
  };
}

export function createNoodlerNoodleImagesService(db: DB) {
  const noodle = createNoodleStorage(db);
  const characters = createCharactersStorage(db);
  const connections = createConnectionsStorage(db);
  const promptOverrides = createPromptOverridesStorage(db);

  return {
    async generateReviewedImages(input: {
      prompts: ReviewedNoodleImagePrompt[];
      debugMode: boolean;
    }): Promise<{ ok: true; finalized: number } | { ok: false; error: "missing_connection"; message: string }> {
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

      let finalized = 0;
      for (const promptOverride of input.prompts) {
        const claimToken = newId();
        // Reuses the shared post-image claim; the NoodleR-account check below rejects any
        // non-NoodleR post so a public post id can never be finalized through this route.
        const claimed = await noodle.claimPostImage(promptOverride.id, claimToken, imageClaimLeaseUntil());
        if (!claimed) continue;
        const account = await noodle.getNoodlerAccountById(claimed.authorAccountId);
        if (!account) {
          await noodle.releasePostImageClaim(claimed.id, claimToken);
          continue;
        }
        const disclosureMode = account.settings.privacy.identityDisclosure ?? "secret";
        const linkedPublicAccount = account.noodleAccountId
          ? await noodle.getAccountById(account.noodleAccountId)
          : null;

        let claimOwned = true;
        const renewClaim = async () => {
          if (!claimOwned) return;
          try {
            claimOwned = await noodle.renewPostImageClaim(claimed.id, claimToken, imageClaimLeaseUntil());
          } catch (error) {
            claimOwned = false;
            logger.warn(error, "[noodler] Failed to renew reviewed image claim for post %s", claimed.id);
          }
        };
        const renewalTimer = setInterval(() => void renewClaim(), REVIEWED_IMAGE_CLAIM_RENEW_MS);
        renewalTimer.unref?.();

        let image: Awaited<ReturnType<typeof generateNoodlerPostImage>>;
        try {
          image = await generateNoodlerPostImage({
            account,
            linkedPublicAccount,
            disclosureMode,
            postContent: claimed.content,
            draftPrompt: claimed.imagePrompt!,
            settings,
            characters,
            promptOverrides,
            imageConnection,
            db,
            debugMode: input.debugMode,
            promptOverride,
          });
        } catch (error) {
          logger.warn(error, "[noodler] Failed to generate reviewed image for %s", account.displayName);
          clearInterval(renewalTimer);
          await renewClaim();
          if (claimOwned) {
            await noodle.finalizePostImageClaim(claimed.id, claimToken, {
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
          image.stagedMedia?.compensate();
          continue;
        }

        // Re-read the profile before finalizing: if disclosure or the linked public identity
        // changed during the (potentially long) provider call, the staged image was built from a
        // now-stale appearance policy, so discard it and finalize as failed rather than publish it.
        const fresh = await noodle.getNoodlerAccountById(claimed.authorAccountId);
        const freshDisclosure = fresh?.settings.privacy.identityDisclosure ?? "secret";
        if (
          !fresh ||
          freshDisclosure !== disclosureMode ||
          (fresh.noodleAccountId ?? null) !== (account.noodleAccountId ?? null)
        ) {
          image.stagedMedia?.compensate();
          await noodle.finalizePostImageClaim(claimed.id, claimToken, {
            imageUrl: null,
            imagePrompt: null,
            metadata: {
              imageGenerationFailed: true,
              imageGenerationError: "Stage profile identity changed during image generation.",
            },
          });
          continue;
        }
        try {
          image.stagedMedia?.promote();
          const ok = await noodle.finalizePostImageClaim(claimed.id, claimToken, {
            imageUrl: noodlerPostMediaUrl(claimed.id),
            metadata: image.metadata,
          });
          if (!ok) {
            image.stagedMedia?.compensate();
            continue;
          }
          finalized += 1;
        } catch (error) {
          image.stagedMedia?.compensate();
          try {
            await noodle.releasePostImageClaim(claimed.id, claimToken);
          } catch (releaseError) {
            logger.warn(releaseError, "[noodler] Failed to release reviewed image claim for post %s", claimed.id);
          }
          throw error;
        }
      }
      return { ok: true, finalized };
    },
  };
}
