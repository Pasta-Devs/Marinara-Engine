// ──────────────────────────────────────────────
// Assign a chat picture to a character's or persona's gallery.
//
// The gallery row points at the chat picture's own file: no second copy. It is
// not linked to the chat picture (no sourceChatImageId), so deleting the chat
// picture or the chat keeps it; the file stays while any gallery uses it.
// The chat picture's label (emoji, sticker, background + places) comes along.
// ──────────────────────────────────────────────
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { GalleryTagKind } from "@marinara-engine/shared";
import { DATA_DIR } from "../../utils/data-dir.js";
import type { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import type { createPersonaGalleryStorage } from "../storage/persona-gallery.storage.js";
import { resolveStoredGalleryFile, withGalleryFileLifecycleLock } from "./gallery-file-lifecycle.js";
import { readGalleryTagPayload } from "./gallery-tag-payload.js";

export type ChatPictureToAssign = {
  filePath: string;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  customKind?: string | null;
  customName?: string | null;
};

export type AssignChatPictureResult =
  { ok: true; image: unknown; alreadyThere: boolean } | { ok: false; reason: "missing-file" | "not-created" };

export async function assignChatPictureToGallery(input: {
  image: ChatPictureToAssign;
  target: { type: "character" | "persona"; id: string };
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
  personaGallery: ReturnType<typeof createPersonaGalleryStorage>;
  /** Test-only filesystem override. */
  galleryRoot?: string;
}): Promise<AssignChatPictureResult> {
  const { image, target } = input;
  const galleryRoot = input.galleryRoot ?? join(DATA_DIR, "gallery");
  const tag = readGalleryTagPayload(
    { customKind: image.customKind ?? null, customName: image.customName },
    { allowBackground: true },
  );
  const label: { customKind: GalleryTagKind | null; customName: string | null } =
    "error" in tag ? { customKind: null, customName: null } : tag.patch;

  return withGalleryFileLifecycleLock(
    image.filePath,
    async () => {
      const storedFile = resolveStoredGalleryFile(image.filePath, galleryRoot);
      if (!storedFile || !existsSync(storedFile.absolutePath)) return { ok: false, reason: "missing-file" } as const;
      const fields = {
        filePath: image.filePath,
        prompt: image.prompt,
        provider: image.provider,
        model: image.model,
        width: image.width ?? undefined,
        height: image.height ?? undefined,
        customKind: label.customKind,
        customName: label.customName,
      };
      // Assigning the same picture again only refreshes its label.
      if (target.type === "character") {
        const gallery = input.characterGallery;
        const existing = (await gallery.listByCharacterId(target.id)).find((row) => row.filePath === image.filePath);
        const row = existing
          ? label.customKind
            ? await gallery.setTag(existing.id, label)
            : existing
          : await gallery.create({ characterId: target.id, ...fields });
        return row
          ? ({ ok: true, image: row, alreadyThere: !!existing } as const)
          : ({ ok: false, reason: "not-created" } as const);
      }
      const gallery = input.personaGallery;
      const existing = (await gallery.listByPersonaId(target.id)).find((row) => row.filePath === image.filePath);
      const row = existing
        ? label.customKind
          ? await gallery.setTag(existing.id, label)
          : existing
        : await gallery.create({ personaId: target.id, ...fields });
      return row
        ? ({ ok: true, image: row, alreadyThere: !!existing } as const)
        : ({ ok: false, reason: "not-created" } as const);
    },
    galleryRoot,
  );
}
