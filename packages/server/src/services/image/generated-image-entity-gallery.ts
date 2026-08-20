import { existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import type { CreateCharacterImageInput } from "../storage/character-gallery.storage.js";
import type { CreatePersonaImageInput } from "../storage/persona-gallery.storage.js";
import { resolveStoredGalleryFile, withGalleryFileLifecycleLock } from "./gallery-file-lifecycle.js";

type CharacterGalleryStore = {
  create(input: CreateCharacterImageInput): Promise<unknown>;
};
type PersonaGalleryStore = {
  create(input: CreatePersonaImageInput): Promise<unknown>;
};

export type GeneratedImageEntityGalleryInput = {
  sourceFilePath: string;
  sourceChatImageId?: string | null;
  characterIds?: string[];
  personaIds?: string[];
  characterGallery: CharacterGalleryStore;
  personaGallery: PersonaGalleryStore;
  prompt: string;
  provider: string;
  model: string;
  width: number;
  height: number;
  signal?: AbortSignal;
  /** Test-only filesystem override. */
  galleryRoot?: string;
};

function safeEntityIds(ids: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (ids ?? []).filter((id) => id.length > 0 && id !== "." && id !== ".." && !id.includes("/") && !id.includes("\\")),
    ),
  );
}

/**
 * Add references to one generated file in every explicitly depicted
 * character/persona gallery. The image bytes remain canonical: gallery
 * membership is metadata, not another physical copy.
 */
export async function persistGeneratedImageToEntityGalleries(
  input: GeneratedImageEntityGalleryInput,
): Promise<{ characterCount: number; personaCount: number }> {
  input.signal?.throwIfAborted();
  const galleryRoot = input.galleryRoot ?? join(DATA_DIR, "gallery");
  return withGalleryFileLifecycleLock(
    input.sourceFilePath,
    async () => {
      input.signal?.throwIfAborted();
      const sourceFile = resolveStoredGalleryFile(input.sourceFilePath, galleryRoot);
      if (!sourceFile || !existsSync(sourceFile.absolutePath)) {
        logger.warn("[image-gallery] Generated source image is missing: %s", input.sourceFilePath);
        return { characterCount: 0, personaCount: 0 };
      }

      const metadata = {
        sourceChatImageId: input.sourceChatImageId ?? null,
        filePath: input.sourceFilePath,
        prompt: input.prompt,
        provider: input.provider,
        model: input.model,
        width: input.width,
        height: input.height,
      };

      const persistOne = async (
        kind: "characters" | "personas",
        entityId: string,
        createMetadata: () => Promise<unknown>,
      ) => {
        try {
          input.signal?.throwIfAborted();
          const created = await createMetadata();
          input.signal?.throwIfAborted();
          if (!created) throw new Error("Gallery metadata row was not created");
          return true;
        } catch (error) {
          input.signal?.throwIfAborted();
          logger.warn(error, "[image-gallery] Could not reference generated image for %s %s", kind, entityId);
          return false;
        }
      };

      let characterCount = 0;
      for (const characterId of safeEntityIds(input.characterIds)) {
        input.signal?.throwIfAborted();
        if (
          await persistOne("characters", characterId, () => input.characterGallery.create({ characterId, ...metadata }))
        ) {
          characterCount += 1;
        }
        input.signal?.throwIfAborted();
      }
      let personaCount = 0;
      for (const personaId of safeEntityIds(input.personaIds)) {
        input.signal?.throwIfAborted();
        if (await persistOne("personas", personaId, () => input.personaGallery.create({ personaId, ...metadata }))) {
          personaCount += 1;
        }
        input.signal?.throwIfAborted();
      }
      return { characterCount, personaCount };
    },
    galleryRoot,
    input.signal,
  );
}
