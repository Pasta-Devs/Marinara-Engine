// The "Game Mode Icon" block of the character and persona Stats tabs: what the card's token
// shows on a fight board. The avatar by default, a picture from the card's own gallery (uploaded
// here or already there), or the initials. A token with no picture always falls back to initials.
import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { parseCombatIconChoice, resolveCombatIconUrl, type CombatIconChoice } from "@marinara-engine/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  characterKeys,
  useCharacterGalleryImages,
  usePersonaGalleryImages,
  useUploadCharacterGalleryImage,
  useUploadPersonaGalleryImage,
} from "../../hooks/use-characters";
import { initialsOf } from "../../lib/tactical-board-look";
import { cn } from "../../lib/utils";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";

type CombatIconMode = CombatIconChoice["source"];

export interface CombatIconGalleryImage {
  id: string;
  url: string;
}

type OwnerProps = {
  name: string;
  avatarUrl: string | null;
  value: unknown;
  onChange: (choice: CombatIconChoice | undefined) => void;
};

/** The gallery list with a just-uploaded picture in it, so the picker never calls it missing while
 *  the refetch is on its way (or if the refetch fails). */
function withUploadedImage<T extends { id: string }>(current: T[] | undefined, image: T): T[] | undefined {
  if (!current || current.some((entry) => entry.id === image.id)) return current;
  return [image, ...current];
}

/** The block for a character card, whose pictures live in the character's gallery. */
export function CharacterCombatIconSection({ characterId, ...props }: OwnerProps & { characterId: string | null }) {
  const { data: images, isLoading } = useCharacterGalleryImages(characterId);
  const upload = useUploadCharacterGalleryImage(characterId ?? "");
  const queryClient = useQueryClient();
  return (
    <GameModeIconSection
      key={characterId ?? "new"}
      {...props}
      images={images}
      imagesLoading={isLoading}
      canUseGallery={!!characterId}
      uploading={upload.isPending}
      onUpload={async (file) => {
        const image = (await upload.mutateAsync([file]))[0];
        if (image && characterId) {
          queryClient.setQueryData(characterKeys.gallery(characterId), (current: typeof images) =>
            withUploadedImage(current, image),
          );
        }
        return image;
      }}
    />
  );
}

/** The block for a persona, whose pictures live in the persona's gallery. */
export function PersonaCombatIconSection({ personaId, ...props }: OwnerProps & { personaId: string | null }) {
  const { data: images, isLoading } = usePersonaGalleryImages(personaId);
  const upload = useUploadPersonaGalleryImage(personaId ?? "");
  const queryClient = useQueryClient();
  return (
    <GameModeIconSection
      key={personaId ?? "new"}
      {...props}
      images={images}
      imagesLoading={isLoading}
      canUseGallery={!!personaId}
      uploading={upload.isPending}
      onUpload={async (file) => {
        const image = (await upload.mutateAsync([file]))[0];
        if (image && personaId) {
          queryClient.setQueryData(characterKeys.personaGallery(personaId), (current: typeof images) =>
            withUploadedImage(current, image),
          );
        }
        return image;
      }}
    />
  );
}

function GameModeIconSection({
  name,
  avatarUrl,
  value,
  onChange,
  images,
  imagesLoading,
  canUseGallery,
  uploading,
  onUpload,
}: {
  name: string;
  avatarUrl: string | null;
  value: unknown;
  /** `undefined` clears the choice, which means the avatar. */
  onChange: (choice: CombatIconChoice | undefined) => void;
  images: readonly CombatIconGalleryImage[] | undefined;
  imagesLoading: boolean;
  /** False until the card is saved: a gallery belongs to a saved card. */
  canUseGallery: boolean;
  uploading: boolean;
  onUpload: (file: File) => Promise<CombatIconGalleryImage | undefined>;
}) {
  const { t } = useUiTranslation();
  const choice = parseCombatIconChoice(value);
  // "Custom image" can be open before a picture is picked; the stored choice changes only on a pick.
  const [pickingImage, setPickingImage] = useState(false);
  const mode: CombatIconMode = choice?.source === "image" || pickingImage ? "image" : (choice?.source ?? "avatar");
  const selectedMissing =
    choice?.source === "image" && !imagesLoading && !!images && !images.some((image) => image.id === choice.imageId);
  // The editor previews the avatar that is on screen, which may be unsaved.
  const previewUrl = selectedMissing ? null : resolveCombatIconUrl(choice, avatarUrl);

  const pickMode = (next: CombatIconMode) => {
    setPickingImage(next === "image");
    if (next === "avatar") onChange(undefined);
    else if (next === "initials") onChange({ source: "initials" });
  };

  const pickImage = (image: CombatIconGalleryImage) => {
    setPickingImage(false);
    onChange({ source: "image", imageId: image.id, url: image.url });
  };

  const handleUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      const image = await onUpload(file);
      if (image) pickImage(image);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.characters.combatIcon.uploadFailed"));
    }
  };

  const modes: Array<{ id: CombatIconMode; label: string; disabled?: boolean }> = [
    { id: "avatar", label: t("ui.characters.combatIcon.modeAvatar") },
    { id: "image", label: t("ui.characters.combatIcon.modeImage"), disabled: !canUseGallery },
    { id: "initials", label: t("ui.characters.combatIcon.modeInitials") },
  ];

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-6" data-testid="game-mode-icon">
      <div>
        <h3 className="text-sm font-semibold">{t("ui.characters.combatIcon.title")}</h3>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{t("ui.characters.combatIcon.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        {/* Drawn the way a party token is: round, with the initials when there is no picture. */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#9dbdff] bg-[rgba(42,71,120,0.92)]"
          aria-label={t("ui.characters.combatIcon.previewLabel", { name })}
          role="img"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-black leading-none text-white/90">{initialsOf(name)}</span>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label={t("ui.characters.combatIcon.title")}
          className="flex flex-wrap gap-1 rounded-lg bg-[var(--secondary)] p-1"
        >
          {modes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={mode === entry.id}
              disabled={entry.disabled}
              onClick={() => pickMode(entry.id)}
              className={cn(
                "min-h-9 rounded-md px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                mode === entry.id
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {!canUseGallery && (
        <p className="text-xs text-[var(--muted-foreground)]">{t("ui.characters.combatIcon.saveFirst")}</p>
      )}
      {mode === "avatar" && !avatarUrl && (
        <p className="text-xs text-[var(--muted-foreground)]">{t("ui.characters.combatIcon.noAvatar")}</p>
      )}

      {mode === "image" && canUseGallery && (
        <div className="space-y-3">
          {selectedMissing && (
            <p role="alert" className="text-xs text-[var(--destructive)]">
              {t("ui.characters.combatIcon.missing")}
            </p>
          )}
          {images && images.length > 0 && (
            <div
              role="listbox"
              aria-label={t("ui.characters.combatIcon.galleryLabel")}
              className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2"
            >
              {images.map((image) => {
                const selected = choice?.source === "image" && choice.imageId === image.id;
                return (
                  <button
                    key={image.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={t("ui.characters.combatIcon.useImage")}
                    onClick={() => pickImage(image)}
                    className={cn(
                      "aspect-square overflow-hidden rounded-full border-2 transition-colors",
                      selected
                        ? "border-[var(--primary)]"
                        : "border-[var(--border)] hover:border-[var(--muted-foreground)]",
                    )}
                  >
                    <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
          <ImageUploadDropzone
            multiple={false}
            label={t("ui.characters.combatIcon.upload")}
            pending={uploading}
            pendingLabel={t("ui.characters.combatIcon.uploading")}
            dragLabel={t("ui.characters.combatIcon.dropImage")}
            onFilesSelected={(files) => void handleUpload(files)}
            icon={<Upload size="1rem" />}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
