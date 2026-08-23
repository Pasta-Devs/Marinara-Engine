// ──────────────────────────────────────────────
// Story Bundle Metadata Tab
// ──────────────────────────────────────────────
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Image, Tag, Upload, X } from "lucide-react";
import { normalizeAvatarCrop, type AvatarCrop } from "@marinara-engine/shared";
import { useRemoveStoryBundleImage, useUploadStoryBundleImage } from "../../hooks/use-story-bundles";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { AvatarCropWidget } from "../ui/AvatarCropWidget";

export interface StoryBundleMetadataProps {
  bundleId: string;
  name: string;
  onNameChange: (value: string) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  creator: string;
  onCreatorChange: (value: string) => void;
  version: string;
  onVersionChange: (value: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  imagePath: string | null;
  avatarCrop: Record<string, unknown> | null;
  onAvatarCropChange: (crop: Record<string, unknown> | null) => void;
}

export function StoryBundleMetadata({
  bundleId,
  name,
  onNameChange,
  comment,
  onCommentChange,
  creator,
  onCreatorChange,
  version,
  onVersionChange,
  tags,
  onTagsChange,
  imagePath,
  avatarCrop,
  onAvatarCropChange,
}: StoryBundleMetadataProps) {
  const { t } = useTranslation();
  const uploadImage = useUploadStoryBundleImage();
  const removeImage = useRemoveStoryBundleImage();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [newTag, setNewTag] = useState("");

  const handlePickImage = useCallback(() => {
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
      imageInputRef.current.click();
    }
  }, []);

  const handleImageSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error(t("storyBundles.invalidImageType", "Please choose an image file."));
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const image = typeof reader.result === "string" ? reader.result : "";
        if (!image) {
          toast.error(t("storyBundles.imageReadFailed", "Failed to read the image."));
          return;
        }
        try {
          await uploadImage.mutateAsync({ id: bundleId, image });
          toast.success(t("storyBundles.imageUpdated", "Bundle picture updated."));
        } catch {
          toast.error(t("storyBundles.imageUploadFailed", "Failed to upload the bundle picture."));
        }
      };
      reader.onerror = () => {
        toast.error(t("storyBundles.imageReadFailed", "Failed to read the image."));
      };
      reader.readAsDataURL(file);
    },
    [bundleId, uploadImage, t],
  );

  const handleRemoveImage = useCallback(async () => {
    if (removeImage.isPending || uploadImage.isPending) return;
    const confirmed = await showConfirmDialog({
      title: t("storyBundles.metadata.removeImageTitle", "Remove Image"),
      message: t(
        "storyBundles.metadata.removeImageMessage",
        "Remove the bundle picture? The image file will be deleted and the avatar crop will be reset.",
      ),
      confirmLabel: t("storyBundles.metadata.removeImageConfirm", "Remove"),
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await removeImage.mutateAsync(bundleId);
      toast.success(t("storyBundles.imageRemoved", "Bundle picture removed."));
    } catch {
      toast.error(t("storyBundles.imageRemoveFailed", "Failed to remove the bundle picture."));
    }
  }, [bundleId, removeImage, uploadImage, t]);

  const addTag = useCallback(() => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setNewTag("");
      return;
    }
    onTagsChange([...tags, trimmed]);
    setNewTag("");
  }, [newTag, tags, onTagsChange]);

  const removeTag = useCallback(
    (tag: string) => {
      onTagsChange(tags.filter((t) => t !== tag));
    },
    [tags, onTagsChange],
  );

  const removeAllTags = useCallback(() => {
    onTagsChange([]);
  }, [onTagsChange]);

  return (
    <div data-testid="story-bundle-editor-metadata" className="flex flex-col gap-5">
      {/* Avatar / Image */}
      <div data-testid="story-bundle-editor-metadata-avatar" className="space-y-1.5">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {t("storyBundles.metadata.avatar", "Avatar")}
        </span>
        <div className="flex items-center gap-3">
          <div
            data-testid="story-bundle-editor-metadata-avatar-preview"
            className={cn(
              "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm",
              imagePath ? "bg-[var(--muted)]" : "bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5",
            )}
          >
            {imagePath ? (
              <img src={imagePath} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <Image size="1.5rem" className="text-[var(--muted-foreground)]" />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              data-testid="story-bundle-editor-metadata-upload-button"
              onClick={handlePickImage}
              disabled={uploadImage.isPending}
              className="mari-chrome-control inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Upload size="0.75rem" />
              {imagePath
                ? t("storyBundles.metadata.changeImage", "Change Image")
                : t("storyBundles.metadata.uploadImage", "Upload Image")}
            </button>
            {uploadImage.isPending && (
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                {t("storyBundles.metadata.uploading", "Uploading…")}
              </span>
            )}
          </div>
        </div>
        <input
          ref={imageInputRef}
          data-testid="story-bundle-editor-metadata-image-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelected}
        />
      </div>

      {/* Avatar Crop */}
      {imagePath && (
        <AvatarCropWidget
          src={imagePath}
          alt={name}
          crop={normalizeAvatarCrop(avatarCrop as unknown as AvatarCrop)}
          onChange={(next) => onAvatarCropChange(next as unknown as Record<string, unknown>)}
          onRemove={handleRemoveImage}
          removing={removeImage.isPending}
        />
      )}

      {/* Bundle ID (read-only) */}
      <div
        data-testid="story-bundle-editor-metadata-bundle-id"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 px-3 py-2"
      >
        <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {t("storyBundles.metadata.bundleId", "Bundle ID")}
        </span>
        <code className="min-w-0 flex-1 break-all rounded-lg bg-[var(--background)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)]">
          {bundleId}
        </code>
      </div>

      {/* Name */}
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {t("storyBundles.metadata.name", "Name")}
        </span>
        <input
          data-testid="story-bundle-editor-metadata-name-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
        />
      </label>

      {/* Title / Comment */}
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {t("storyBundles.metadata.comment", "Title / Comment")}
        </span>
        <input
          data-testid="story-bundle-editor-metadata-comment-input"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={t("storyBundles.metadata.commentPlaceholder", "A short note shown under the bundle name…")}
        />
      </label>

      {/* Creator */}
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {t("storyBundles.metadata.creator", "Creator")}
        </span>
        <input
          data-testid="story-bundle-editor-metadata-creator-input"
          value={creator}
          onChange={(e) => onCreatorChange(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={t("storyBundles.metadata.creatorPlaceholder", "Your name or handle…")}
        />
      </label>

      {/* Version */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {t("storyBundles.metadata.version", "Version")}
        </span>
        <input
          data-testid="story-bundle-editor-metadata-version-input"
          value={version}
          onChange={(e) => onVersionChange(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={t("storyBundles.metadata.versionPlaceholder", "1.0.0")}
        />
      </div>

      {/* Tags */}
      <div data-testid="story-bundle-editor-metadata-tags" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {t("storyBundles.metadata.tags", "Tags")}
          </span>
          {tags.length > 0 && (
            <button
              type="button"
              data-testid="story-bundle-editor-metadata-tags-remove-all"
              onClick={removeAllTags}
              className="mari-chrome-accent-surface mari-accent-animated rounded-lg border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
            >
              {t("storyBundles.metadata.removeAll", "Remove All")}
            </button>
          )}
        </div>
        <div data-testid="story-bundle-editor-metadata-tags-list" className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              data-testid={`story-bundle-editor-metadata-tag-${tag}`}
              className="mari-chrome-control mari-chrome-control--compact group/tag"
            >
              <Tag size="0.625rem" />
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
                title={t("storyBundles.metadata.removeTag", "Remove tag")}
              >
                <X size="0.625rem" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            data-testid="story-bundle-editor-metadata-tag-input"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={t("storyBundles.metadata.addTag", "Add tag…")}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none focus:border-[var(--primary)]/40"
          />
          <button
            type="button"
            data-testid="story-bundle-editor-metadata-tag-add-button"
            onClick={addTag}
            className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected px-3 py-1.5"
          >
            {t("storyBundles.metadata.add", "Add")}
          </button>
        </div>
      </div>
    </div>
  );
}
